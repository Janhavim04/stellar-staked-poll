#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};

#[contracttype]
pub enum DataKey {
    Admin,
    Initialized,
}

#[contract]
pub struct VoteTokenContract;

#[contractimpl]
impl VoteTokenContract {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Initialized) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Initialized, &true);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        let token_client = token::StellarAssetClient::new(&env, &env.current_contract_address());
        token_client.mint(&to, &amount);
    }

    pub fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        let token_client = token::TokenClient::new(&env, &env.current_contract_address());
        token_client.burn(&from, &amount);
    }

    pub fn balance(env: Env, addr: Address) -> i128 {
        let token_client = token::TokenClient::new(&env, &env.current_contract_address());
        token_client.balance(&addr)
    }
}
