import React, { useState } from 'react';
import { ethers } from 'ethers';
import './App.css';

// --- SVG Icons (as React Components) ---
const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="upload-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
);

const LockIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
);

const CubeIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
);

const LayersIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
);

// --- BLOCKCHAIN CONSTANTS ---
// Your specific contract address on Sepolia
const CONTRACT_ADDRESS = "0x62f6bBB2e20707dce3bA7078A7d1ce3126Fb7Fb7"; 

const CONTRACT_ABI=[[
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "_documentId",
				"type": "bytes32"
			},
			{
				"internalType": "bytes32",
				"name": "_documentHash",
				"type": "bytes32"
			}
		],
		"name": "createDocument",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "documentId",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "bytes32",
				"name": "documentHash",
				"type": "bytes32"
			},
			{
				"indexed": true,
				"internalType": "address",
				"name": "creator",
				"type": "address"
			}
		],
		"name": "DocumentCreated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{
				"indexed": true,
				"internalType": "bytes32",
				"name": "documentId",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "bytes32",
				"name": "newHash",
				"type": "bytes32"
			},
			{
				"indexed": false,
				"internalType": "bytes32",
				"name": "previousHash",
				"type": "bytes32"
			}
		],
		"name": "DocumentUpdated",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "_documentId",
				"type": "bytes32"
			},
			{
				"internalType": "bytes32",
				"name": "_newDocumentHash",
				"type": "bytes32"
			}
		],
		"name": "updateDocument",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			},
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "documentHistory",
		"outputs": [
			{
				"internalType": "bytes32",
				"name": "documentHash",
				"type": "bytes32"
			},
			{
				"internalType": "bytes32",
				"name": "previousHash",
				"type": "bytes32"
			},
			{
				"internalType": "uint256",
				"name": "timestamp",
				"type": "uint256"
			},
			{
				"internalType": "address",
				"name": "recordedBy",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "bytes32",
				"name": "_documentId",
				"type": "bytes32"
			}
		],
		"name": "getLatestHash",
		"outputs": [
			{
				"internalType": "bytes32",
				"name": "",
				"type": "bytes32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
]];


// --- Main App Component ---
function App() {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  
  // Analysis State
  const [docHash, setDocHash] = useState('');
  const [clauses, setClauses] = useState([]);
  const [docType, setDocType] = useState('');     // NEW: For Document Type
  const [score, setScore] = useState(0);          // NEW: For Risk Score
  const [entities, setEntities] = useState([]);   // NEW: For Extracted Entities
  
  // Status State
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isNotarizing, setIsNotarizing] = useState(false);
  const [txHash, setTxHash] = useState('');

  const resetState = () => {
    setFile(null);
    setFileName('');
    setDocHash('');
    setClauses([]);
    setDocType('');
    setScore(0);
    setEntities([]);
    setError('');
    setIsProcessing(false);
    setIsNotarizing(false);
    setTxHash('');
  };

  const handleFileChange = (selectedFile) => {
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setError('');
      setFile(selectedFile);
      setFileName(selectedFile.name);
      processDocument(selectedFile);
    } else {
      setError('Please upload a valid PDF file.');
      setFile(null);
      setFileName('');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileChange(files[0]);
    }
  };

  // --- PHASE 2 INTEGRATION: AI ANALYSIS ---
  const processDocument = async (doc) => {
    setIsProcessing(true);
    setError('');
    
    const formData = new FormData();
    formData.append('pdf', doc);

    try {
       const response = await fetch('http://localhost:3001/analyze', {
        method: 'POST',
        body: formData,
       });
       
       if (!response.ok) throw new Error('Server analysis failed');
       
       const data = await response.json();
       
       // Update state with data from Python Analyzer
       setDocHash(data.docHash);
       setClauses(data.risks);
       setDocType(data.type);       // Save Document Type
       setScore(data.score);        // Save Score
       setEntities(data.entities);  // Save Entities
       
       setIsProcessing(false);

    } catch (err) {
        console.error(err);
        setError('Failed to analyze document. Is the backend server running?');
        setIsProcessing(false);
    }
  };

  // --- PHASE 3 INTEGRATION: BLOCKCHAIN ---
  const handleNotarize = async () => {
      if (!window.ethereum) {
          setError("MetaMask is not installed. Please install it to continue.");
          return;
      }

      setIsNotarizing(true);
      setError('');

      try {
          // 1. Connect to MetaMask
          const provider = new ethers.BrowserProvider(window.ethereum);
          await provider.send("eth_requestAccounts", []);
          const signer = await provider.getSigner();

          // 2. Switch to Sepolia Testnet
          const chainId = '0xaa36a7'; // Sepolia Chain ID
          
          try {
              await window.ethereum.request({
                  method: 'wallet_switchEthereumChain',
                  params: [{ chainId }],
              });
          } catch (switchError) {
              if (switchError.code === 4902) {
                  setError("Sepolia testnet is not added to your MetaMask. Please add it manually.");
              } else {
                  console.warn("Could not switch to Sepolia. Attempting to proceed...");
              }
          }

          // 3. Interact with the Contract
          // Use the constant defined at the top
          const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
          
          const tx = await contract.storeHash(docHash);
          console.log("Transaction sent:", tx.hash);
          
          await tx.wait(); // Wait for the transaction to be mined
          setTxHash(tx.hash);
          
      } catch (err) {
          console.error(err);
          // Ethers.js errors often have a 'reason' or 'message' property
          const errorMessage = err.reason || err.message || "An error occurred during notarization.";
          
          if (errorMessage.includes("already notarized")) {
             setError("This document has already been verified on the blockchain!");
          } else {
             setError(errorMessage);
          }
          setIsNotarizing(false);
      }
  };


  return (
    <div className="container">
      <header className="header">
        <div className="logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="logo-icon"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5-10-5-10 5z"></path></svg>
          <h1>Veritas Ledger</h1>
        </div>
        <nav className="nav">
          <a href="#">Features</a>
          <a href="#">Security</a>
          <a href="#">Analytics</a>
          <a href="#">About</a>
        </nav>
        <div className="actions">
          <button className="btn btn-secondary">Sign In</button>
          <button className="btn btn-primary">Get Started</button>
        </div>
      </header>

      <main className="main-content">
        {!docHash && !txHash && (
          <>
            <div className="hero">
              <h2>Secure Document Verification with Blockchain Technology</h2>
              <p>Upload your PDF contracts for instant AI analysis and permanent blockchain verification. Get cryptographic proof of authenticity with Veritas Ledger.</p>
            </div>
            
            <div 
              className={`dropzone ${isProcessing ? 'processing' : ''}`}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <input 
                type="file" 
                id="file-upload" 
                accept=".pdf" 
                onChange={(e) => handleFileChange(e.target.files[0])}
                style={{ display: 'none' }} 
              />
              {isProcessing ? (
                <div className="spinner"></div>
              ) : (
                <>
                  <UploadIcon />
                  <h3>Drop your PDF contract here</h3>
                  <p>Upload your document for instant analysis and blockchain verification</p>
                  <label htmlFor="file-upload" className="btn btn-primary">
                    Choose File
                  </label>
                  <span className="file-info">{fileName || "PDF contracts only"}</span>
                  {error && <p className="error-message">{error}</p>}
                </>
              )}
            </div>
            
            <section className="features">
              <div className="feature-card">
                <div className="feature-icon"><LockIcon /></div>
                <h3>Instant Analysis</h3>
                <p>AI-powered clause detection and SHA-256 fingerprinting in seconds.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon"><CubeIcon /></div>
                <h3>Blockchain Proof</h3>
                <p>Immutable timestamping on Ethereum Sepolia testnet.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon"><LayersIcon /></div>
                <h3>Permanent Record</h3>
                <p>Shareable Etherscan links for document authenticity proof.</p>
              </div>
            </section>
          </>
        )}

        {docHash && !txHash && (
           <div className="analysis-container">
            {/* NEW: Analysis Header with Type and Score */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #333', paddingBottom: '1rem' }}>
                <div>
                    <h2>Analysis Complete</h2>
                    <span style={{ 
                        background: '#3700b3', 
                        padding: '0.25rem 0.75rem', 
                        borderRadius: '4px', 
                        fontSize: '0.9rem',
                        marginTop: '0.5rem',
                        display: 'inline-block'
                    }}>
                        {docType || "Unknown Document"}
                    </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: score > 70 ? '#4caf50' : score > 40 ? '#ffc107' : '#cf6679' }}>
                        {score}/100
                    </div>
                    <span style={{ color: '#b3b3b3', fontSize: '0.9rem' }}>Safety Score</span>
                </div>
            </div>

            <div className="analysis-result">
              <div className="hash-section">
                <h4>Document Hash (SHA-256)</h4>
                <p className="hash-value" title={docHash}>{docHash}</p>
                <button className="copy-btn" onClick={() => navigator.clipboard.writeText(docHash)}>Copy Hash</button>
                
                {/* NEW: Entities Section */}
                {entities.length > 0 && (
                    <div style={{ marginTop: '2rem' }}>
                        <h4>Key Entities Detected</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {entities.map((ent, i) => (
                                <span key={i} style={{ 
                                    background: '#1e1e1e', 
                                    border: '1px solid #333', 
                                    padding: '0.25rem 0.5rem', 
                                    borderRadius: '4px',
                                    fontSize: '0.85rem',
                                    color: '#bb86fc'
                                }}>
                                    {ent}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
              </div>

              <div className="clauses-section">
                <h4>Risk Assessment</h4>
                <ul>
                  {clauses.map((clause, index) => (
                    <li key={index} className={clause.status} style={{ marginBottom: '1rem' }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                        {clause.status === 'detected' ? '✅' : clause.status === 'warning' ? '⚠️' : '❌'} {clause.name}
                      </div>
                      {clause.explanation && (
                          <div style={{ fontSize: '0.85rem', color: '#b3b3b3', marginLeft: '1.5rem' }}>
                              {clause.explanation}
                          </div>
                      )}
                    </li>
                  ))}
                  {clauses.length === 0 && <li className="detected">No obvious risks detected.</li>}
                </ul>
              </div>
            </div>
            
            <div className="notarize-action">
              <h3>Create a Tamper-Proof Record</h3>
              <p>Store the document's unique hash on the Sepolia blockchain forever. This action will require a MetaMask transaction.</p>
              <button className="btn btn-primary btn-large" onClick={handleNotarize} disabled={isNotarizing}>
                {isNotarizing ? <><div className="spinner-small"></div> Notarizing...</> : 'Notarize on Blockchain'}
              </button>
              {error && <p className="error-message">{error}</p>}
            </div>
          </div>
        )}

        {txHash && (
          <div className="confirmation-container">
            <h2>Notarization Successful!</h2>
            <p>Your document's unique hash has been permanently recorded on the blockchain.</p>
            <div className="tx-info">
              <h4>Transaction Hash</h4>
              <a 
                href={`https://sepolia.etherscan.io/tx/${txHash}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="tx-link"
              >
                {txHash}
              </a>
              <p className="info-text">You can view and share this transaction on Etherscan as permanent proof.</p>
            </div>
            <button className="btn btn-secondary" onClick={resetState}>Verify Another Document</button>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;