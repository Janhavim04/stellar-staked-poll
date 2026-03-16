import { useState, useEffect, useCallback } from 'react'
import {
  Horizon,
  rpc,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  Keypair,
  Account,
  nativeToScVal,
  scValToNative
} from '@stellar/stellar-sdk'
import {
  StellarWalletsKit,
  WalletNetwork,
  FREIGHTER_ID,
  FreighterModule,
  xBullModule,
  LobstrModule,
  HanaModule
} from '@creit.tech/stellar-wallets-kit'
import './App.css'

// ── Constants ──
const STAKED_POLL_ID     = 'CCGMIHJBNDRICJXHA64Y7KIGL6L5VCY5LR6USZRUD5MCJE5QPZIVAXUD'
const VOTE_TOKEN_ID      = 'CALJYXH3VYMYBMD4GVHM74UO5FKO7DZQ2IA2IB6NQTEXTUAEZOPT4ZL5'
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015'
const HORIZON_URL        = 'https://horizon-testnet.stellar.org'
const RPC_URL            = 'https://soroban-testnet.stellar.org'
const CACHE_KEY          = 'staked_poll_results'
const CACHE_TTL          = 30
const STROOP             = 10000000 // 1 XLM = 10,000,000 stroops

const server    = new Horizon.Server(HORIZON_URL)
const rpcServer = new rpc.Server(RPC_URL)

const kit = new StellarWalletsKit({
  network: WalletNetwork.TESTNET,
  selectedWalletId: FREIGHTER_ID,
  modules: [
    new FreighterModule(),
    new xBullModule(),
    new LobstrModule(),
    new HanaModule(),
  ]
})

function App() {
  const [walletAddress, setWalletAddress]       = useState(null)
  const [balance, setBalance]                   = useState(null)
  const [hasVoted, setHasVoted]                 = useState(false)
  const [hasClaimed, setHasClaimed]             = useState(false)
  const [voterStake, setVoterStake]             = useState(0)
  const [yesStake, setYesStake]                 = useState(0)
  const [noStake, setNoStake]                   = useState(0)
  const [deadline, setDeadline]                 = useState(0)
  const [minStake, setMinStake]                 = useState(0)
  const [stakeAmount, setStakeAmount]           = useState('')
  const [txStatus, setTxStatus]                 = useState(null)
  const [txHash, setTxHash]                     = useState('')
  const [txStep, setTxStep]                     = useState('')
  const [txProgress, setTxProgress]             = useState(0)
  const [errorMessage, setErrorMessage]         = useState('')
  const [isConnecting, setIsConnecting]         = useState(false)
  const [isVoting, setIsVoting]                 = useState(false)
  const [isClaiming, setIsClaiming]             = useState(false)
  const [isLoadingResults, setIsLoadingResults] = useState(true)
  const [lastUpdated, setLastUpdated]           = useState(null)
  const [pollClosed, setPollClosed]             = useState(false)
  const [timeLeft, setTimeLeft]                 = useState('')


  // ── Simulate a read-only contract call ──
  const simulateCall = useCallback(async (contractId, method, args = []) => {
    const contract      = new Contract(contractId)
    const sourceKeypair = Keypair.random()
    const sourceAccount = new Account(sourceKeypair.publicKey(), '0')
    const tx = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build()
    return await rpcServer.simulateTransaction(tx)
  }, [])


  // ── Fetch poll results with caching ──
  const fetchResults = useCallback(async () => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        const age = (Date.now() - parsed.timestamp) / 1000
        if (age < CACHE_TTL) {
          setYesStake(parsed.yes)
          setNoStake(parsed.no)
          setDeadline(parsed.deadline)
          setMinStake(parsed.minStake)
          setLastUpdated(new Date(parsed.timestamp))
          setIsLoadingResults(false)
          return
        }
      }

      const [resultsRes, deadlineRes, minStakeRes] = await Promise.all([
        simulateCall(STAKED_POLL_ID, 'get_results'),
        simulateCall(STAKED_POLL_ID, 'get_deadline'),
        simulateCall(STAKED_POLL_ID, 'get_min_stake'),
      ])

      if (rpc.Api.isSimulationSuccess(resultsRes)) {
        const native = scValToNative(resultsRes.result.retval)
        if (Array.isArray(native)) {
          const yes = Number(native[0])
          const no  = Number(native[1])
          setYesStake(yes)
          setNoStake(no)

          const dl  = scValToNative(deadlineRes.result.retval)
          const ms  = scValToNative(minStakeRes.result.retval)
          setDeadline(Number(dl))
          setMinStake(Number(ms))
          setLastUpdated(new Date())

          localStorage.setItem(CACHE_KEY, JSON.stringify({
            yes, no,
            deadline: Number(dl),
            minStake: Number(ms),
            timestamp: Date.now()
          }))
        }
      }
    } catch (err) {
      console.error('Failed to fetch results:', err)
    } finally {
      setIsLoadingResults(false)
    }
  }, [simulateCall])


  // ── Countdown timer ──
  useEffect(() => {
    if (!deadline) return
    const tick = () => {
      const now  = Math.floor(Date.now() / 1000)
      const diff = deadline - now
      if (diff <= 0) {
        setPollClosed(true)
        setTimeLeft('Poll Closed')
        return
      }
      const d = Math.floor(diff / 86400)
      const h = Math.floor((diff % 86400) / 3600)
      const m = Math.floor((diff % 3600) / 60)
      const s = diff % 60
      setTimeLeft(`${d}d ${h}h ${m}m ${s}s`)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [deadline])


  // ── Poll every 5 seconds ──
  useEffect(() => {
    fetchResults()
    const interval = setInterval(fetchResults, 5000)
    return () => clearInterval(interval)
  }, [fetchResults])


  // ── Connect Wallet ──
  const connectWallet = async () => {
    setIsConnecting(true)
    setErrorMessage('')
    await new Promise(r => setTimeout(r, 300))
    try {
      await kit.openModal({
        onWalletSelected: async (option) => {
          try {
            kit.setWallet(option.id)
            const { address } = await kit.getAddress()
            setWalletAddress(address)
            await fetchBalance(address)
            await fetchVoterInfo(address)
          } catch (err) {
            setErrorMessage('Wallet connection failed.')
          }
        }
      })
    } catch (err) {
      setErrorMessage('Could not open wallet selector.')
    }
    setIsConnecting(false)
  }


  // ── Disconnect ──
  const disconnectWallet = () => {
    setWalletAddress(null)
    setBalance(null)
    setHasVoted(false)
    setHasClaimed(false)
    setVoterStake(0)
    setTxStatus(null)
    setTxHash('')
    setErrorMessage('')
    setTxProgress(0)
    setTxStep('')
  }


  // ── Fetch Balance ──
  const fetchBalance = async (address) => {
    try {
      const account = await server.loadAccount(address)
      const xlm = account.balances.find(b => b.asset_type === 'native')
      setBalance(xlm ? parseFloat(xlm.balance).toFixed(4) : '0.0000')
    } catch {
      setBalance('0.0000')
    }
  }


  // ── Fetch voter info ──
  const fetchVoterInfo = async (address) => {
    try {
      const addrVal = nativeToScVal(address, { type: 'address' })
      const [votedRes, claimedRes, stakeRes] = await Promise.all([
        simulateCall(STAKED_POLL_ID, 'has_voted',       [addrVal]),
        simulateCall(STAKED_POLL_ID, 'has_claimed',     [addrVal]),
        simulateCall(STAKED_POLL_ID, 'get_voter_stake', [addrVal]),
      ])
      if (rpc.Api.isSimulationSuccess(votedRes))
        setHasVoted(scValToNative(votedRes.result.retval) === true)
      if (rpc.Api.isSimulationSuccess(claimedRes))
        setHasClaimed(scValToNative(claimedRes.result.retval) === true)
      if (rpc.Api.isSimulationSuccess(stakeRes))
        setVoterStake(Number(scValToNative(stakeRes.result.retval)))
    } catch (err) {
      console.error('Failed to fetch voter info:', err)
    }
  }


  // ── Submit signed transaction ──
  const submitTx = async (contractId, method, args) => {
    const contract = new Contract(contractId)
    const account  = await server.loadAccount(walletAddress)

    setTxStep('Building transaction...')
    setTxProgress(20)

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build()

    setTxStep('Simulating...')
    setTxProgress(40)
    const simResult = await rpcServer.simulateTransaction(tx)

    if (!rpc.Api.isSimulationSuccess(simResult)) {
      throw new Error(simResult.error || 'Simulation failed')
    }

    setTxStep('Preparing...')
    setTxProgress(55)
    const preparedTx = rpc.assembleTransaction(tx, simResult).build()

    setTxStep('Waiting for wallet signature...')
    setTxProgress(70)
    const { signedTxXdr } = await kit.signTransaction(
      preparedTx.toXDR(),
      { networkPassphrase: NETWORK_PASSPHRASE }
    )

    setTxStep('Broadcasting...')
    setTxProgress(85)
    const signedTx   = TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE)
    const sendResult = await rpcServer.sendTransaction(signedTx)

    if (sendResult.status === 'ERROR') throw new Error('Network rejected transaction')

    setTxStep('Confirming...')
    let txResult
    let attempts = 0
    while (attempts < 20) {
      await new Promise(r => setTimeout(r, 1500))
      txResult = await rpcServer.getTransaction(sendResult.hash)
      if (txResult.status === 'SUCCESS') break
      if (txResult.status === 'FAILED')  break
      attempts++
      setTxProgress(prev => Math.min(prev + 1, 95))
    }

    if (txResult.status !== 'SUCCESS') throw new Error('Transaction failed on chain')

    return sendResult.hash
  }


  // ── Cast Vote ──
  const castVote = async (option) => {
    if (!walletAddress || !stakeAmount) return
    const amountInStroops = Math.floor(parseFloat(stakeAmount) * STROOP)
    if (amountInStroops < minStake) {
      setErrorMessage(`Minimum stake is ${minStake / STROOP} XLM`)
      return
    }

    setIsVoting(true)
    setTxStatus('pending')
    setErrorMessage('')
    setTxHash('')
    setTxProgress(0)

    try {
      const hash = await submitTx(STAKED_POLL_ID, 'vote', [
        nativeToScVal(walletAddress, { type: 'address' }),
        nativeToScVal(option, { type: 'u32' }),
        nativeToScVal(amountInStroops, { type: 'i128' }),
      ])
      setTxProgress(100)
      setTxStep('Vote confirmed!')
      setTxHash(hash)
      setTxStatus('success')
      setHasVoted(true)
      setVoterStake(amountInStroops)
      localStorage.removeItem(CACHE_KEY)
      await fetchResults()
      await fetchBalance(walletAddress)
    } catch (err) {
      console.error('Vote error:', err)
      const msg = err.message || ''
      if (msg.includes('AlreadyVoted') || msg.includes('(1)')) {
        setErrorMessage('You have already voted!')
      } else if (msg.includes('PollClosed') || msg.includes('(3)')) {
        setErrorMessage('The poll has closed.')
      } else if (msg.includes('InvalidOption') || msg.includes('(2)')) {
        setErrorMessage('Invalid option or stake too low.')
      } else {
        setErrorMessage('Something went wrong. Please try again.')
      }
      setTxStatus('error')
      setTxProgress(0)
    }
    setIsVoting(false)
  }


  // ── Claim Winnings ──
  const claimWinnings = async () => {
    if (!walletAddress) return
    setIsClaiming(true)
    setTxStatus('pending')
    setErrorMessage('')
    setTxHash('')
    setTxProgress(0)

    try {
      const hash = await submitTx(STAKED_POLL_ID, 'claim', [
        nativeToScVal(walletAddress, { type: 'address' }),
      ])
      setTxProgress(100)
      setTxStep('Claimed!')
      setTxHash(hash)
      setTxStatus('success')
      setHasClaimed(true)
      await fetchBalance(walletAddress)
    } catch (err) {
      console.error('Claim error:', err)
      const msg = err.message || ''
      if (msg.includes('NothingToClaim') || msg.includes('(5)')) {
        setErrorMessage('Nothing to claim — you voted for the losing side.')
      } else if (msg.includes('AlreadyClaimed') || msg.includes('(6)')) {
        setErrorMessage('You have already claimed your winnings.')
      } else if (msg.includes('PollStillOpen') || msg.includes('(4)')) {
        setErrorMessage('Poll is still open — wait for it to close.')
      } else {
        setErrorMessage('Claim failed. Please try again.')
      }
      setTxStatus('error')
      setTxProgress(0)
    }
    setIsClaiming(false)
  }


  // ── Helpers ──
  const totalStake  = yesStake + noStake
  const yesPercent  = totalStake === 0 ? 50 : Math.round((yesStake / totalStake) * 100)
  const noPercent   = totalStake === 0 ? 50 : Math.round((noStake  / totalStake) * 100)
  const toXLM       = (stroops) => (stroops / STROOP).toFixed(2)
  const formatTime  = (date) => date ? date.toLocaleTimeString() : ''


  return (
    <div className="app">
      <div className="bg-grid"></div>
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>

      <div className="page-wrapper">

        {/* HEADER */}
        <header className="header">
          <div className="logo">
            <div className="logo-icon">
              <svg viewBox="0 0 32 32" fill="none">
                <polygon points="16,2 30,9 30,23 16,30 2,23 2,9"
                  stroke="url(#lg)" strokeWidth="1.5" fill="none"/>
                <circle cx="16" cy="16" r="3" fill="url(#lg)"/>
                <defs>
                  <linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#63b3ed"/>
                    <stop offset="100%" stopColor="#a78bfa"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div>
              <div className="logo-text">StellarPoll</div>
              <div className="logo-sub">Stake XLM · Vote · Win</div>
            </div>
          </div>
          <div className="header-right">
            {timeLeft && (
              <div className={`timer-badge ${pollClosed ? 'timer-closed' : ''}`}>
                {pollClosed ? '🔒 Closed' : `⏱ ${timeLeft}`}
              </div>
            )}
            <div className="network-badge">
              <span className="network-dot"></span>
              Testnet
            </div>
          </div>
        </header>

        <main className="main">

          {/* POLL STATS — always visible */}
          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-card-value">{toXLM(totalStake)} XLM</div>
              <div className="stat-card-label">Total Staked</div>
            </div>
            <div className="stat-card yes-card">
              <div className="stat-card-value">{toXLM(yesStake)} XLM</div>
              <div className="stat-card-label">Yes Pool</div>
            </div>
            <div className="stat-card no-card">
              <div className="stat-card-value">{toXLM(noStake)} XLM</div>
              <div className="stat-card-label">No Pool</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-value">{toXLM(minStake)} XLM</div>
              <div className="stat-card-label">Min Stake</div>
            </div>
          </div>

          {!walletAddress ? (

            /* NOT CONNECTED */
            <div className="landing">
              <div className="hero-glow"></div>

              <div className="poll-preview">
                <div className="poll-preview-tag">Live Staked Poll</div>
                <h1 className="poll-question">
                  Is Stellar the best blockchain?
                </h1>
                <p className="poll-description">
                  Stake XLM to vote. Winners split the losing pool proportionally.
                  Voters receive VOTE tokens as proof of participation.
                </p>

                {isLoadingResults ? (
                  <div className="results-loading">
                    <span className="spinner"></span>
                    Loading live results...
                  </div>
                ) : (
                  <>
                    <div className="results-bar">
                      <div className="results-bar-yes" style={{width: yesPercent + '%'}}>
                        {yesPercent > 10 && <span className="bar-label">{yesPercent}%</span>}
                      </div>
                      <div className="results-bar-no" style={{width: noPercent + '%'}}>
                        {noPercent > 10 && <span className="bar-label">{noPercent}%</span>}
                      </div>
                    </div>
                    <div className="bar-labels-row">
                      <span className="yes-color">Yes — {toXLM(yesStake)} XLM</span>
                      <span className="no-color">No — {toXLM(noStake)} XLM</span>
                    </div>
                    {lastUpdated && (
                      <div className="last-updated">Updated at {formatTime(lastUpdated)}</div>
                    )}
                  </>
                )}
              </div>

              <p className="connect-prompt">Connect your wallet to stake and vote</p>

              <button
                className={isConnecting ? 'connect-btn loading' : 'connect-btn'}
                onClick={connectWallet}
                disabled={isConnecting}
              >
                <span className="btn-inner">
                  {isConnecting ? <><span className="spinner"></span>Connecting...</> : <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Connect Wallet to Vote
                  </>}
                </span>
              </button>

              <div className="wallet-options-hint">
                <span>Supports</span>
                <span className="wallet-chip">Freighter</span>
                <span className="wallet-chip">xBull</span>
                <span className="wallet-chip">LOBSTR</span>
                <span className="wallet-chip">Hana</span>
              </div>
            </div>

          ) : (

            /* CONNECTED */
            <div className="dashboard">

              <div className="wallet-bar">
                <div className="wallet-bar-left">
                  <span className="connected-dot"></span>
                  <span className="wallet-addr">
                    {walletAddress.slice(0,6)}...{walletAddress.slice(-4)}
                  </span>
                  <span className="wallet-balance">{balance} XLM</span>
                  {hasVoted && (
                    <span className="stake-badge">
                      Staked {toXLM(voterStake)} XLM
                    </span>
                  )}
                </div>
                <button className="disconnect-btn" onClick={disconnectWallet}>
                  Disconnect
                </button>
              </div>

              <div className="poll-card">
                <div className="poll-card-tag">
                  <span className="live-dot"></span>
                  {pollClosed ? 'Poll Closed' : 'Live Poll'}
                </div>

                <h2 className="poll-card-question">
                  Is Stellar the best blockchain?
                </h2>

                {isLoadingResults ? (
                  <div className="results-loading">
                    <span className="spinner"></span>
                    Loading results...
                  </div>
                ) : (
                  <>
                    <div className="vote-counts">
                      <div className="vote-count-item yes-color">
                        <span className="vote-count-num">{toXLM(yesStake)}</span>
                        <span className="vote-count-label">XLM Yes</span>
                      </div>
                      <div className="vote-count-total">{toXLM(totalStake)} XLM total</div>
                      <div className="vote-count-item no-color">
                        <span className="vote-count-num">{toXLM(noStake)}</span>
                        <span className="vote-count-label">XLM No</span>
                      </div>
                    </div>

                    <div className="results-bar">
                      <div className="results-bar-yes" style={{width: yesPercent + '%'}}>
                        {yesPercent > 10 && <span className="bar-label">{yesPercent}%</span>}
                      </div>
                      <div className="results-bar-no" style={{width: noPercent + '%'}}>
                        {noPercent > 10 && <span className="bar-label">{noPercent}%</span>}
                      </div>
                    </div>

                    <div className="bar-labels-row">
                      <span className="yes-color">Yes</span>
                      <span className="no-color">No</span>
                    </div>

                    {lastUpdated && (
                      <div className="last-updated">Updated at {formatTime(lastUpdated)}</div>
                    )}
                  </>
                )}

                {/* VOTE SECTION */}
                {!hasVoted && !pollClosed && (
                  <div className="vote-actions">
                    <p className="vote-prompt">
                      Stake XLM to vote — winners share the losing pool!
                    </p>
                    <div className="stake-input-wrapper">
                      <input
                        type="number"
                        className="stake-input"
                        placeholder={`Min ${toXLM(minStake)} XLM`}
                        value={stakeAmount}
                        onChange={e => setStakeAmount(e.target.value)}
                        disabled={isVoting}
                        min={toXLM(minStake)}
                        step="1"
                      />
                      <span className="stake-input-suffix">XLM</span>
                    </div>
                    <div className="vote-buttons">
                      <button
                        className="vote-btn vote-yes"
                        onClick={() => castVote(0)}
                        disabled={isVoting || !stakeAmount}
                      >
                        <span className="btn-inner">
                          {isVoting ? <span className="spinner"></span> : <span>✓</span>}
                          {isVoting ? 'Staking...' : 'Vote Yes'}
                        </span>
                      </button>
                      <button
                        className="vote-btn vote-no"
                        onClick={() => castVote(1)}
                        disabled={isVoting || !stakeAmount}
                      >
                        <span className="btn-inner">
                          {isVoting ? <span className="spinner"></span> : <span>✕</span>}
                          {isVoting ? 'Staking...' : 'Vote No'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* ALREADY VOTED */}
                {hasVoted && !pollClosed && (
                  <div className="already-voted">
                    <div className="already-voted-icon">✦</div>
                    <div className="already-voted-text">
                      You staked {toXLM(voterStake)} XLM — waiting for poll to close
                    </div>
                  </div>
                )}

                {/* CLAIM SECTION */}
                {hasVoted && pollClosed && !hasClaimed && (
                  <div className="claim-section">
                    <p className="claim-prompt">Poll is closed! Claim your winnings if you voted for the winning side.</p>
                    <button
                      className="claim-btn"
                      onClick={claimWinnings}
                      disabled={isClaiming}
                    >
                      <span className="btn-inner">
                        {isClaiming ? <span className="spinner"></span> : '🏆'}
                        {isClaiming ? 'Claiming...' : 'Claim Winnings'}
                      </span>
                    </button>
                  </div>
                )}

                {/* CLAIMED */}
                {hasClaimed && (
                  <div className="already-voted">
                    <div className="already-voted-icon">🏆</div>
                    <div className="already-voted-text">Winnings claimed successfully!</div>
                  </div>
                )}

                {/* PROGRESS BAR */}
                {txStatus === 'pending' && (
                  <div className="tx-progress-wrapper">
                    <div className="tx-step-label">
                      <span className="spinner"></span>
                      {txStep}
                    </div>
                    <div className="tx-progress-bar">
                      <div className="tx-progress-fill" style={{width: txProgress + '%'}}></div>
                    </div>
                    <div className="tx-progress-pct">{txProgress}%</div>
                  </div>
                )}

                {txStatus === 'success' && (
                  <div className="tx-status tx-success">
                    <div>✦ Transaction confirmed!</div>
                    <div className="tx-hash">Hash: {txHash.slice(0,16)}...{txHash.slice(-8)}</div>
                    <a className="tx-link"
                      href={'https://stellar.expert/explorer/testnet/tx/' + txHash}
                      target="_blank" rel="noreferrer">
                      View on Stellar Expert
                    </a>
                  </div>
                )}

                {txStatus === 'error' && (
                  <div className="tx-status tx-error">
                    <div>✕ {errorMessage}</div>
                  </div>
                )}

              </div>

              {/* CONTRACT INFO */}
              <div className="contracts-info">
                <div className="contract-row">
                  <span className="contract-label">StakedPoll</span>
                  <span className="contract-id">{STAKED_POLL_ID.slice(0,10)}...{STAKED_POLL_ID.slice(-6)}</span>
                  <a className="contract-link"
                    href={'https://stellar.expert/explorer/testnet/contract/' + STAKED_POLL_ID}
                    target="_blank" rel="noreferrer">View</a>
                </div>
                <div className="contract-row">
                  <span className="contract-label">VoteToken</span>
                  <span className="contract-id">{VOTE_TOKEN_ID.slice(0,10)}...{VOTE_TOKEN_ID.slice(-6)}</span>
                  <a className="contract-link"
                    href={'https://stellar.expert/explorer/testnet/contract/' + VOTE_TOKEN_ID}
                    target="_blank" rel="noreferrer">View</a>
                </div>
              </div>

            </div>
          )}

        </main>

        <footer className="footer">
          StellarPoll · Stake XLM · Win Rewards · Built on Stellar Testnet
        </footer>

      </div>
    </div>
  )
}

export default App
