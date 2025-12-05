import React, { useState } from 'react';
import { ethers } from 'ethers';
import './App.css';

// --- SVG Icons ---
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
const CONTRACT_ADDRESS = "0x62f6bBB2e20707dce3bA7078A7d1ce3126Fb7Fb7"; 
const CONTRACT_ABI=[
	{"inputs":[{"internalType":"bytes32","name":"_documentId","type":"bytes32"},{"internalType":"bytes32","name":"_documentHash","type":"bytes32"}],"name":"createDocument","outputs":[],"stateMutability":"nonpayable","type":"function"},
	{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"documentId","type":"bytes32"},{"indexed":false,"internalType":"bytes32","name":"documentHash","type":"bytes32"},{"indexed":true,"internalType":"address","name":"creator","type":"address"}],"name":"DocumentCreated","type":"event"},
	{"anonymous":false,"inputs":[{"indexed":true,"internalType":"bytes32","name":"documentId","type":"bytes32"},{"indexed":false,"internalType":"bytes32","name":"newHash","type":"bytes32"},{"indexed":false,"internalType":"bytes32","name":"previousHash","type":"bytes32"}],"name":"DocumentUpdated","type":"event"},
	{"inputs":[{"internalType":"bytes32","name":"_documentId","type":"bytes32"},{"internalType":"bytes32","name":"_newDocumentHash","type":"bytes32"}],"name":"updateDocument","outputs":[],"stateMutability":"nonpayable","type":"function"},
	{"inputs":[{"internalType":"bytes32","name":"","type":"bytes32"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"documentHistory","outputs":[{"internalType":"bytes32","name":"documentHash","type":"bytes32"},{"internalType":"bytes32","name":"previousHash","type":"bytes32"},{"internalType":"uint256","name":"timestamp","type":"uint256"},{"internalType":"address","name":"recordedBy","type":"address"}],"stateMutability":"view","type":"function"},
	{"inputs":[{"internalType":"bytes32","name":"_documentId","type":"bytes32"}],"name":"getLatestHash","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"}
];

function App() {
  // --- Global State ---
  const [activeTab, setActiveTab] = useState('new'); // 'new', 'update', 'verify'
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // --- "New Document" & "Update" Shared State ---
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [docHash, setDocHash] = useState(''); // The hash of the current file
  const [clauses, setClauses] = useState([]);
  const [docType, setDocType] = useState('');
  const [score, setScore] = useState(0);
  const [entities, setEntities] = useState([]);
  
  // --- "Update" Specific State ---
  const [originalHash, setOriginalHash] = useState(''); // The ID of the doc being updated
  
  // --- "Verify" Specific State ---
  const [verifyId, setVerifyId] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);

  // --- Transaction State ---
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
    setVerifyResult(null);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    resetState();
    // Clear inputs specific to tabs
    setOriginalHash('');
    setVerifyId('');
  };

  // --- Helper: File Handling ---
  const handleFileChange = (selectedFile) => {
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setError('');
      setFile(selectedFile);
      setFileName(selectedFile.name);
      processDocument(selectedFile); // Auto-analyze on drop
    } else {
      setError('Please upload a valid PDF file.');
    }
  };

  // --- Helper: Blockchain Connection ---
  const getContract = async () => {
      if (!window.ethereum) throw new Error("MetaMask is not installed.");
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  };

  // --- ACTION: Analyze PDF (Server) ---
  const processDocument = async (doc) => {
    setIsProcessing(true);
    setError('');
    const formData = new FormData();
    formData.append('pdf', doc);

    try {
       const response = await fetch('http://localhost:3001/analyze', { method: 'POST', body: formData });
       if (!response.ok) throw new Error('Server analysis failed');
       const data = await response.json();
       
       setDocHash(data.docHash);
       setClauses(data.risks);
       setDocType(data.type);
       setScore(data.score);
       setEntities(data.entities);
    } catch (err) {
        console.error(err);
        setError('Analysis failed. Is the server running?');
    } finally {
        setIsProcessing(false);
    }
  };

  // --- ACTION: Create New Document (Blockchain) ---
  const handleCreateDocument = async () => {
      if (!docHash) return;
      setIsNotarizing(true);
      try {
          const contract = await getContract();
          // For a new doc, we use the hash as the ID
          const tx = await contract.createDocument(docHash, docHash);
          await tx.wait();
          setTxHash(tx.hash);
      } catch (err) {
          console.error(err);
          setError(err.reason || err.message);
      } finally {
          setIsNotarizing(false);
      }
  };

  // --- ACTION: Update Document (Blockchain) ---
  const handleUpdateDocument = async () => {
      if (!docHash || !originalHash) {
          setError("Please provide the original document hash and upload the new version.");
          return;
      }
      setIsNotarizing(true);
      try {
          const contract = await getContract();
          const tx = await contract.updateDocument(originalHash, docHash);
          await tx.wait();
          setTxHash(tx.hash);
      } catch (err) {
          console.error(err);
          setError(err.reason || err.message);
      } finally {
          setIsNotarizing(false);
      }
  };

  // --- ACTION: Verify/Check Document (Blockchain) ---
  const handleVerify = async () => {
      if (!verifyId) {
        setError("Please enter a document ID.");
        return;
      }

      setIsProcessing(true);
      setError('');
      setVerifyResult(null);
      
      try {
          // 1. Get Contract
          const contract = await getContract();
          
          // 2. Call Smart Contract
          // NOTE: verifyId MUST be a hex string (0x...) or this fails
          const latest = await contract.getLatestHash(verifyId);
          
          // 3. Check if empty result (0x000...) which means ID doesn't exist
          if (latest === '0x0000000000000000000000000000000000000000000000000000000000000000') {
              setError("Document ID not found on blockchain.");
          } else {
              setVerifyResult({
                  inputId: verifyId,
                  latestHash: latest,
                  match: verifyId.toLowerCase() === latest.toLowerCase() // Case-insensitive check
              });
          }
      } catch (err) {
          console.error(err);
          setError("Verification failed. Invalid ID format or network error.");
      } finally {
          setIsProcessing(false);
      }
  };

  // --- Sub-Component: Analysis Report ---
  const AnalysisReport = () => (
    <div className="analysis-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #333', paddingBottom: '1rem' }}>
            <div>
                <h2>Analysis Complete</h2>
                <span className="doc-badge">{docType || "Unknown"}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: score > 70 ? '#00e676' : score > 40 ? '#ffeb3b' : '#cf6679' }}>
                    {score}/100
                </div>
                <span style={{ color: '#b3b3b3', fontSize: '0.9rem' }}>Safety Score</span>
            </div>
        </div>

        <div className="analysis-result">
            <div className="hash-section">
                <h4>New Version Hash</h4>
                <p className="hash-value">{docHash}</p>
                {/* Entities omitted for brevity, add back if needed */}
            </div>
            <div className="clauses-section">
                <h4>Risk Scan</h4>
                <ul>
                    {clauses.map((c, i) => (
                        <li key={i} className={c.status}>
                           <div>{c.status === 'detected' ? '✅' : '⚠️'} {c.name}</div>
                        </li>
                    ))}
                    {clauses.length === 0 && <li className="detected">No obvious risks detected.</li>}
                </ul>
            </div>
        </div>
        
        <div className="notarize-action">
            {activeTab === 'new' ? (
                <button className="btn btn-primary btn-large" onClick={handleCreateDocument} disabled={isNotarizing}>
                    {isNotarizing ? 'Notarizing...' : 'Create Record on Blockchain'}
                </button>
            ) : (
                <button className="btn btn-primary btn-large" onClick={handleUpdateDocument} disabled={isNotarizing}>
                    {isNotarizing ? 'Updating...' : 'Update Version on Blockchain'}
                </button>
            )}
            {error && <p className="error-message">{error}</p>}
        </div>
    </div>
  );

  return (
    <div className="container">
      <header className="header">
        <div className="logo">
           {/* Simple Logo SVG */}
           <svg width="24" height="24" viewBox="0 0 24 24" fill="var(--primary-color)" className="logo-icon"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5-10-5-10 5z"></path></svg>
           <h1>Veritas Ledger</h1>
        </div>
        
        {/* --- TABS --- */}
        <div className="nav-tabs">
            <button className={`nav-tab ${activeTab === 'new' ? 'active' : ''}`} onClick={() => handleTabChange('new')}>New Document</button>
            <button className={`nav-tab ${activeTab === 'update' ? 'active' : ''}`} onClick={() => handleTabChange('update')}>Update Version</button>
            <button className={`nav-tab ${activeTab === 'verify' ? 'active' : ''}`} onClick={() => handleTabChange('verify')}>Verify Hash</button>
        </div>
        
        <div className="actions">
           {/* Placeholder for wallet connect status if needed */}
        </div>
      </header>

      <main className="main-content">
        
        {/* --- VIEW: NEW DOCUMENT --- */}
        {activeTab === 'new' && !txHash && (
            <>
                {!docHash ? (
                    <div className="dropzone-wrapper">
                        <h2>Upload New Contract</h2>
                        <div className={`dropzone ${isProcessing ? 'processing' : ''}`}>
                            <input type="file" id="file-upload" accept=".pdf" onChange={(e) => handleFileChange(e.target.files[0])} />
                            {isProcessing ? <div className="spinner"></div> : (
                                <label htmlFor="file-upload">
                                    <UploadIcon />
                                    <p>Click to upload PDF</p>
                                </label>
                            )}
                        </div>
                    </div>
                ) : (
                    <AnalysisReport />
                )}
            </>
        )}

        {/* --- VIEW: UPDATE VERSION --- */}
        {activeTab === 'update' && !txHash && (
            <div className="update-container">
                <h2>Update Existing Document</h2>
                <div className="input-group">
                    <label>Original Document Hash (ID)</label>
                    <input 
                        type="text" 
                        placeholder="0x..." 
                        value={originalHash}
                        onChange={(e) => setOriginalHash(e.target.value)}
                        className="text-input"
                    />
                </div>
                
                {!docHash ? (
                    <div className="input-group">
                         <label>Upload New Version (PDF)</label>
                         <div className={`dropzone small ${isProcessing ? 'processing' : ''}`}>
                            <input type="file" id="file-upload-update" accept=".pdf" onChange={(e) => handleFileChange(e.target.files[0])} />
                             {isProcessing ? <div className="spinner-small"></div> : (
                                <label htmlFor="file-upload-update" className="btn btn-secondary">Select File</label>
                            )}
                         </div>
                    </div>
                ) : (
                    <AnalysisReport />
                )}
            </div>
        )}

  {activeTab === 'verify' && (
    <div className="verify-container">
        <h2>Verify Document Authenticity</h2>
        <div className="search-box">
            <input 
                type="text" 
                placeholder="Enter Document Hash (0x...)" 
                value={verifyId} 
                onChange={(e) => setVerifyId(e.target.value)} /* <-- CRITICAL: Must update state */
                className="text-input"
            />
            <button className="btn btn-primary" onClick={handleVerify} disabled={isProcessing}>
                {isProcessing ? 'Checking...' : 'Verify'}
            </button>
        </div>
        
        {/* Display Error if any */}
        {error && <p className="error-message">{error}</p>}
        
        {/* Display Result if successful */}
        {verifyResult && (
            <div className="verification-result">
                <div className="result-card">
                    <div className="icon">{verifyResult.match ? '✅' : '⚠️'}</div>
                    <h3>{verifyResult.match ? 'Valid: This is the Latest Version' : 'Warning: Newer Version Exists'}</h3>
                    <p><strong>Input ID:</strong> {verifyResult.inputId}</p>
                    <p><strong>Latest On-Chain:</strong> {verifyResult.latestHash}</p>
                </div>
            </div>
        )}
    </div>
)}

        {/* --- SUCCESS MESSAGE --- */}
        {txHash && (
          <div className="confirmation-container">
            <h2>Success!</h2>
            <p>Transaction recorded on Sepolia.</p>
            <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer" className="tx-link">View on Etherscan</a>
            <button className="btn btn-secondary" style={{marginTop: '1rem'}} onClick={resetState}>Start Over</button>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;