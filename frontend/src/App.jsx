import { useCurrentAccount, useConnectWallet, useWallets, useDisconnectWallet } from '@mysten/dapp-kit'
import { useEffect, useState, useRef } from 'react'
import './App.css'

function ConnectButton({ eveVault, connecting, onConnect }) {
  if (!eveVault) {
    return (
      <div className="no-vault">
        EVE Vault extension not detected. Install it to continue.
        <br />
        <a href="https://github.com/evefrontier/evevault/releases/latest/download/eve-vault-chrome.zip" className="install-link">
          Download EVE Vault
        </a>
      </div>
    )
  }
  return (
    <button className="connect-btn" disabled={connecting} onClick={onConnect}>
      {connecting ? 'Connecting...' : 'Connect EVE Vault'}
    </button>
  )
}

function AccountInfo({ account, onDisconnect }) {
  return (
    <div className="account-info">
      <div className="account-label">Connected Wallet</div>
      <div className="account-address">{account.address.slice(0, 6)}...{account.address.slice(-4)}</div>
      <button className="disconnect-btn" onClick={onDisconnect}>Disconnect</button>
    </div>
  )
}

export default function App() {
  const account = useCurrentAccount()
  const wallets = useWallets()
  const { mutate: connect, isPending: connecting } = useConnectWallet()
  const { mutate: disconnect } = useDisconnectWallet()
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const connectingRef = useRef(false)

  const eveVault = wallets.find(function(w) { return w.name.includes('Eve Vault') })

  useEffect(function() {
    if (account && account.address && !connectingRef.current) {
      connectingRef.current = true
      handleConnect(account.address)
    }
  }, [account?.address])

  async function handleConnect(address) {
    setStatus('Scanning blockchain for your base...')
    setError('')
    try {
      const res = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address })
      })
      const data = await res.json()
      if (data.success) {
        setStatus('Connected as ' + data.characterName + ' — redirecting...')
        window.location.href = '/?from=vault'
      } else {
        connectingRef.current = false
        setError(data.error)
        setStatus('')
      }
    } catch (e) {
      connectingRef.current = false
      setError('Failed to connect to IDS server')
      setStatus('')
    }
  }

  async function handleDisconnect() {
    disconnect()
    await fetch('/api/disconnect', { method: 'POST' })
    connectingRef.current = false
    setStatus('')
    setError('')
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-header">
          <div className="dot"></div>
          <span className="title">EVE FRONTIER // IDS</span>
        </div>
        <div className="login-body">
          <div className="label">Connect Your Base</div>
          <div className="desc">Connect your EVE Vault wallet to automatically detect your deployed structures and begin monitoring.</div>
          {account
            ? <AccountInfo account={account} onDisconnect={handleDisconnect} />
            : <ConnectButton eveVault={eveVault} connecting={connecting} onConnect={function() { connect({ wallet: eveVault }) }} />
          }
          {status ? <div className="status-msg">{status}</div> : null}
          {error ? <div className="error-msg">{error}</div> : null}
        </div>
        <div className="login-footer">
          Your wallet address is public blockchain data. No private keys or seed phrases are ever required.
        </div>
      </div>
      <div className="version">EVE FRONTIER IDS // VAULT LOGIN // STILLNESS NETWORK</div>
    </div>
  )
}
