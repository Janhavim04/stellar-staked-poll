#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror,
    token, Address, Env,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum PollError {
    AlreadyVoted   = 1,
    InvalidOption  = 2,
    PollClosed     = 3,
    PollStillOpen  = 4,
    NothingToClaim = 5,
    AlreadyClaimed = 6,
    NotInitialized = 7,
}

#[contracttype]
pub enum DataKey {
    Admin,
    TokenContract,
    Deadline,
    MinStake,
    YesStake,
    NoStake,
    VoterOption(Address),
    VoterStake(Address),
    VoterClaimed(Address),
    Initialized,
}

#[contract]
pub struct StakedPollContract;

#[contractimpl]
impl StakedPollContract {

    pub fn initialize(
        env: Env,
        admin: Address,
        token_contract: Address,
        deadline_seconds: u64,
        min_stake: i128,
    ) -> Result<(), PollError> {
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(PollError::NotInitialized);
        }
        admin.require_auth();
        let deadline = env.ledger().timestamp() + deadline_seconds;
        env.storage().instance().set(&DataKey::Admin,         &admin);
        env.storage().instance().set(&DataKey::TokenContract, &token_contract);
        env.storage().instance().set(&DataKey::Deadline,      &deadline);
        env.storage().instance().set(&DataKey::MinStake,      &min_stake);
        env.storage().instance().set(&DataKey::YesStake,      &0i128);
        env.storage().instance().set(&DataKey::NoStake,       &0i128);
        env.storage().instance().set(&DataKey::Initialized,   &true);
        Ok(())
    }

    pub fn vote(
        env: Env,
        voter: Address,
        option: u32,
        amount: i128,
    ) -> Result<(), PollError> {
        voter.require_auth();
        if !env.storage().instance().has(&DataKey::Initialized) {
            return Err(PollError::NotInitialized);
        }
        let deadline: u64 = env.storage().instance().get(&DataKey::Deadline).unwrap();
        if env.ledger().timestamp() > deadline {
            return Err(PollError::PollClosed);
        }
        if option > 1 {
            return Err(PollError::InvalidOption);
        }
        if env.storage().persistent().has(&DataKey::VoterOption(voter.clone())) {
            return Err(PollError::AlreadyVoted);
        }
        let min_stake: i128 = env.storage().instance().get(&DataKey::MinStake).unwrap();
        if amount < min_stake {
            return Err(PollError::InvalidOption);
        }
        let xlm_token = token::TokenClient::new(&env, &get_xlm_address(&env));
        xlm_token.transfer(&voter, &env.current_contract_address(), &amount);
        env.storage().persistent().set(&DataKey::VoterOption(voter.clone()), &option);
        env.storage().persistent().set(&DataKey::VoterStake(voter.clone()),  &amount);
        if option == 0 {
            let yes: i128 = env.storage().instance().get(&DataKey::YesStake).unwrap();
            env.storage().instance().set(&DataKey::YesStake, &(yes + amount));
        } else {
            let no: i128 = env.storage().instance().get(&DataKey::NoStake).unwrap();
            env.storage().instance().set(&DataKey::NoStake, &(no + amount));
        }
        let token_contract: Address = env.storage().instance()
            .get(&DataKey::TokenContract).unwrap();
        let vote_token = VoteTokenClient::new(&env, &token_contract);
        vote_token.mint(&voter, &amount);
        env.events().publish(
            (soroban_sdk::symbol_short!("voted"),),
            (voter, option, amount)
        );
        Ok(())
    }

    pub fn claim(env: Env, voter: Address) -> Result<i128, PollError> {
        voter.require_auth();
        let deadline: u64 = env.storage().instance().get(&DataKey::Deadline).unwrap();
        if env.ledger().timestamp() <= deadline {
            return Err(PollError::PollStillOpen);
        }
        if !env.storage().persistent().has(&DataKey::VoterOption(voter.clone())) {
            return Err(PollError::NothingToClaim);
        }
        if env.storage().persistent().has(&DataKey::VoterClaimed(voter.clone())) {
            return Err(PollError::AlreadyClaimed);
        }
        let voter_option: u32 = env.storage().persistent()
            .get(&DataKey::VoterOption(voter.clone())).unwrap();
        let voter_stake: i128 = env.storage().persistent()
            .get(&DataKey::VoterStake(voter.clone())).unwrap();
        let yes_total: i128 = env.storage().instance().get(&DataKey::YesStake).unwrap();
        let no_total:  i128 = env.storage().instance().get(&DataKey::NoStake).unwrap();
        let total = yes_total + no_total;
        let winning_option: u32 = if yes_total >= no_total { 0 } else { 1 };
        let winning_total:  i128 = if winning_option == 0 { yes_total } else { no_total };
        if voter_option != winning_option {
            env.storage().persistent().set(&DataKey::VoterClaimed(voter.clone()), &true);
            return Err(PollError::NothingToClaim);
        }
        let payout = (voter_stake * total) / winning_total;
        let xlm_token = token::TokenClient::new(&env, &get_xlm_address(&env));
        xlm_token.transfer(&env.current_contract_address(), &voter, &payout);
        env.storage().persistent().set(&DataKey::VoterClaimed(voter.clone()), &true);
        env.events().publish(
            (soroban_sdk::symbol_short!("claimed"),),
            (voter, payout)
        );
        Ok(payout)
    }

    pub fn get_results(env: Env) -> (i128, i128) {
        let yes: i128 = env.storage().instance().get(&DataKey::YesStake).unwrap_or(0);
        let no:  i128 = env.storage().instance().get(&DataKey::NoStake).unwrap_or(0);
        (yes, no)
    }

    pub fn get_deadline(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::Deadline).unwrap_or(0)
    }

    pub fn get_min_stake(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::MinStake).unwrap_or(0)
    }

    pub fn has_voted(env: Env, voter: Address) -> bool {
        env.storage().persistent().has(&DataKey::VoterOption(voter))
    }

    pub fn get_voter_stake(env: Env, voter: Address) -> i128 {
        env.storage().persistent()
            .get(&DataKey::VoterStake(voter))
            .unwrap_or(0)
    }

    pub fn has_claimed(env: Env, voter: Address) -> bool {
        env.storage().persistent().has(&DataKey::VoterClaimed(voter))
    }
}

fn get_xlm_address(env: &Env) -> Address {
    Address::from_string(&soroban_sdk::String::from_str(
        env,
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
    ))
}

mod vote_token {
    soroban_sdk::contractimport!(
        file = "C:/Users/Janhavi/Desktop/stellar-staked-poll/target/wasm32-unknown-unknown/release/vote_token.wasm"
    );
}
use vote_token::Client as VoteTokenClient;
