import React, { useState } from 'react';
import { ethers } from 'ethers';
import './App.css';

// --- SVG Icons ---
const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="upload-icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
);

const ChipIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'5px'}}><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line></svg>
);

// --- BLOCKCHAIN CONSTANTS ---
// Ensure this matches your DEPLOYED contract address
const CONTRACT_ADDRESS = "0x62f6bBB2e20707dce3bA7078A7d1ce3126Fb7Fb7"; 

// Updated ABI matching your new Smart Contract
const CONTRACT_ABI = [
	{
		"inputs": [
			{ "internalType": "bytes32", "name": "_documentId", "type": "bytes32" },
			{ "internalType": "bytes32", "name": "_documentHash", "type": "bytes32" }
		],
		"name": "createDocument",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "bytes32", "name": "_documentId", "type": "bytes32" },
			{ "internalType": "bytes32", "name": "_newDocumentHash", "type": "bytes32" }
		],
		"name": "updateDocument",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{ "internalType": "bytes32", "name": "_documentId", "type": "bytes32" }
		],
		"name": "getLatestHash",
		"outputs": [
			{ "internalType": "bytes32", "name": "", "type": "bytes32" }
		],
		"stateMutability": "view",
		"type": "function"
	},
    // Events
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": true, "internalType": "bytes32", "name": "documentId", "type": "bytes32" },
			{ "indexed": false, "internalType": "bytes32", "name": "documentHash", "type": "bytes32" },
			{ "indexed": true, "internalType": "address", "name": "creator", "type": "address" }
		],
		"name": "DocumentCreated",
		"type": "event"
	},
	{
		"anonymous": false,
		"inputs": [
			{ "indexed": true, "internalType": "bytes32", "name": "documentId", "type": "bytes32" },
			{ "indexed": false, "internalType": "bytes32", "name": "newHash", "type": "bytes32" },
			{ "indexed": false, "internalType": "bytes32", "name": "previousHash", "type": "bytes32" }
		],
		"name": "DocumentUpdated",
		"type": "event"
	}
];

function App() {
  const [activeTab, setActiveTab] = useState('new');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [docHash, setDocHash] = useState('');
  const [clauses, setClauses] = useState([]);
  const [docType, setDocType] = useState('');
  const [score, setScore] = useState(0);
  const [entities, setEntities] = useState([]);
  
  const [originalHash, setOriginalHash] = useState('');
  const [verifyId, setVerifyId] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);

  const [isNotarizing, setIsNotarizing] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [summary, setSummary] = useState('');
  const [missingClauses, setMissingClauses] = useState([]);

  const resetState = () => {
    setFile(null);
    setFileName('');
    setDocHash('');
    setClauses([]);
    setDocType('');
    setScore(0);
    setEntities([]);
    setSummary('');
    setMissingClauses([]);
    
    setError('');
    setIsProcessing(false);
    setIsNotarizing(false);
    setTxHash('');
    setVerifyResult(null);
  };

  const handleTabChange = (tab) => {
    if (isProcessing || isNotarizing) return; 
    setActiveTab(tab);
    resetState();
    setOriginalHash('');
    setVerifyId('');
  };

  const handleFileChange = (selectedFile) => {
    if (selectedFile) {
        if (selectedFile.type !== 'application/pdf') {
            setError('Only PDF files are supported.');
            return;
        }
        setError('');
        setFile(selectedFile);
        setFileName(selectedFile.name);
        processDocument(selectedFile);
    }
  };

  const getContract = async () => {
      if (!window.ethereum) throw new Error("MetaMask is not installed.");
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  };

  const processDocument = async (doc) => {
    setIsProcessing(true);
    setError('');
    const formData = new FormData();
    formData.append('pdf', doc);

    try {
       const response = await fetch('http://localhost:3001/analyze', { method: 'POST', body: formData });
       
       if (!response.ok) {
           const errText = await response.text();
           throw new Error(errText || 'Server analysis failed');
       }
       
       const data = await response.json();
       console.log("🔴 BACKEND DATA RECEIVED:", data);
       if (data.error) throw new Error(data.error);

       setDocHash(data.docHash);
       setClauses(data.risks || []);
       setDocType(data.type);
       setScore(data.score);
       setEntities(data.entities || []);
       // NEW: Set summary and missing clauses
       setSummary(data.summary || "No summary available.");
       setMissingClauses(data.missing_clauses || []);

    } catch (err) {
        console.error("Analysis Error:", err);
        setError(`Analysis failed: ${err.message}. Is the server running on port 3001?`);
    } finally {
        setIsProcessing(false);
    }
  };


  // --- ACTION: Create New Document ---
  const handleCreateDocument = async () => {
      if (!docHash) return;
      setIsNotarizing(true);
      setError('');
      try {
          const contract = await getContract();
          const tx = await contract.createDocument(docHash, docHash);
          await tx.wait();
          setTxHash(tx.hash);
      } catch (err) {
          console.error("Create Error:", err);
          if (err.reason && err.reason.includes("Document already exists")) {
              setError("❌ This document ID is already registered. Please use 'Update Version' instead.");
          } else {
              setError(err.reason || err.message || "Transaction failed");
          }
      } finally {
          setIsNotarizing(false);
      }
  };

  // --- ACTION: Update Document ---
  const handleUpdateDocument = async () => {
      if (!docHash || !originalHash) {
          setError("Please provide the original document hash and upload the new version.");
          return;
      }

      if (!/^0x[a-fA-F0-9]{64}$/.test(originalHash)) {
          setError("❌ Invalid ID Format. A valid Document ID must be a 64-character hex string starting with '0x'.");
          return;
      }

      setIsNotarizing(true);
      setError('');
      try {
          const contract = await getContract();
          const tx = await contract.updateDocument(originalHash, docHash);
          await tx.wait();
          setTxHash(tx.hash);
      } catch (err) {
          console.error("Update Error:", err);
          
          const errMsg = (err.reason || err.message || "").toLowerCase();

          if (errMsg.includes("document not found")) {
              setError("❌ Original Document ID not found on blockchain. Are you using the Transaction Hash by mistake? Please use the Document ID.");
          } else if (errMsg.includes("hash is identical")) {
              setError("❌ This version is identical to the previous one. No update needed.");
          } else {
              setError("Update failed. Check console for details.");
          }
      } finally {
          setIsNotarizing(false);
      }
  };

  // --- ACTION: Verify Document ---
  const handleVerify = async () => {
      if (!verifyId) {
        setError("Please enter a document ID.");
        return;
      }

      setIsProcessing(true);
      setError('');
      setVerifyResult(null);
      
      try {
          const contract = await getContract();
          
          if (!/^0x[a-fA-F0-9]{64}$/.test(verifyId)) {
             throw new Error("Invalid ID format. Must be a 64-char hex string (0x...).");
          }

          const latest = await contract.getLatestHash(verifyId);
          
          setVerifyResult({
              inputId: verifyId,
              latestHash: latest,
              match: verifyId.toLowerCase() === latest.toLowerCase()
          });

      } catch (err) {
          console.error("Verify Error:", err);
          const errMsg = (err.reason || err.message || "").toLowerCase();

          if (errMsg.includes("document not found")) {
              setError("❌ Document ID not found on the blockchain.");
          } else {
              setError("Verification failed. Please check the ID and your network.");
          }
      } finally {
          setIsProcessing(false);
      }
  };

  const copyToClipboard = (text) => {
      navigator.clipboard.writeText(text);
      alert("Copied to clipboard!");
  };

  const AnalysisReport = () => (
    <div className="analysis-container fade-in">
        <div className="analysis-header">
            <div>
                <h2>Analysis Complete</h2>
                <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                    <span className="doc-badge">{docType || "Unknown"}</span>
                    <span style={{fontSize:'0.8rem', color:'#00e676', display:'flex', alignItems:'center', border:'1px solid #00e676', padding:'2px 8px', borderRadius:'12px'}}>
                        <ChipIcon /> Hybrid AI Active
                    </span>
                </div>
            </div>
            <div className="score-container">
                <div className="score-value" style={{ color: score > 70 ? '#00e676' : score > 40 ? '#ffeb3b' : '#cf6679' }}>
                    {score}/100
                </div>
                <span className="score-label">Safety Score</span>
            </div>
        </div>

        <div className="analysis-result">
            <div className="summary-section" style={{gridColumn: '1 / -1', background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px', marginBottom: '1rem'}}>
                <h4 style={{marginTop: 0, color: '#bb86fc'}}>📄 Document Summary</h4>
                <p style={{color: '#ddd', lineHeight: '1.6', fontSize: '0.95rem'}}>{summary}</p>
            </div>

            <div className="hash-section">
                <h4>Calculated SHA-256 Hash</h4>
                <div className="hash-display">{docHash}</div>
                <small className="hash-note">This is the unique digital fingerprint of your file.</small>
                
                {/* NEW: Missing Clauses Section */}
                {missingClauses.length > 0 && (
                    <div style={{marginTop: '2rem'}}>
                        <h4 style={{color: '#ffeb3b'}}>⚠️ Missing Key Clauses</h4>
                        <ul style={{paddingLeft: '20px', color: '#ccc'}}>
                            {missingClauses.map((clause, i) => (
                                <li key={i} style={{marginBottom: '5px'}}>{clause} (Recommended)</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div className="clauses-section">
                <h4>Risk Scan</h4>
                <ul className="risk-list">
                    {clauses.map((c, i) => (
                        <li key={i} className={`risk-item ${c.status}`}>
                           <div className="risk-title">{c.status === 'detected' ? '✅' : '⚠️'} {c.name}</div>
                           <div className="risk-desc">{c.explanation}</div>
                        </li>
                    ))}
                    {clauses.length === 0 && <li className="risk-item detected">No obvious risks detected.</li>}
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
           <h1>Veritas Ledger</h1>
        </div>
        
        <div className="nav-tabs">
            <button className={`nav-tab ${activeTab === 'new' ? 'active' : ''}`} onClick={() => handleTabChange('new')}>New Document</button>
            <button className={`nav-tab ${activeTab === 'update' ? 'active' : ''}`} onClick={() => handleTabChange('update')}>Update Version</button>
            <button className={`nav-tab ${activeTab === 'verify' ? 'active' : ''}`} onClick={() => handleTabChange('verify')}>Verify Hash</button>
        </div>
        <div className="actions"></div>
      </header>

      <main className="main-content">
        
        {/* --- VIEW: NEW DOCUMENT --- */}
        {activeTab === 'new' && !txHash && (
            <>
                {!docHash ? (
                    <div className="dropzone-wrapper fade-in">
                        <h2 className="section-title">Upload New Contract</h2>
                        <div className={`dropzone ${isProcessing ? 'processing' : ''}`}>
                            <input type="file" id="file-upload" accept=".pdf" onChange={(e) => handleFileChange(e.target.files[0])} />
                            {isProcessing ? <div className="spinner"></div> : (
                                <label htmlFor="file-upload" className="dropzone-label">
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

        {activeTab === 'update' && !txHash && (
            <div className="update-container fade-in">
                <h2 className="section-title">Update Existing Document</h2>
                <div className="input-group">
                    <label>Original Document ID (First Version Hash)</label>
                    <input 
                        type="text" 
                        placeholder="Paste the Document ID of the FIRST version here (0x...)" 
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
            <div className="verify-container fade-in">
                <h2 className="section-title">Verify Document Authenticity</h2>
                <p className="section-desc">Enter the <strong>Original Document ID</strong> (the hash of the very first version uploaded) to check for updates.</p>
                <div className="search-box">
                    <input 
                        type="text" 
                        placeholder="Enter Document ID (0x...)" 
                        value={verifyId} 
                        onChange={(e) => setVerifyId(e.target.value)} 
                        className="text-input"
                    />
                    <button className="btn btn-primary" onClick={handleVerify} disabled={isProcessing}>
                        {isProcessing ? 'Checking...' : 'Verify'}
                    </button>
                </div>
                
                {error && <p className="error-message">{error}</p>}
                {verifyResult && (
                    <div className="verification-result fade-in">
                        <div className="result-card" style={{
                            borderColor: verifyResult.match ? '#00e676' : '#ffeb3b',
                            background: verifyResult.match ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 235, 59, 0.1)'
                        }}>
                            <div className="result-icon">{verifyResult.match ? '✅' : '⚠️'}</div>
                            <h3>{verifyResult.match ? 'Valid: This is the Latest Version' : 'Warning: Newer Version Exists'}</h3>
                            <div className="result-details">
                                <p><strong>Input ID:</strong> <span className="mono">{verifyResult.inputId}</span></p>
                                <p><strong>Latest Hash On-Chain:</strong> <span className="mono">{verifyResult.latestHash}</span></p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {txHash && (
          <div className="confirmation-container fade-in">
            <h2>Success!</h2>
            <p>Transaction recorded on Sepolia.</p>
            <div className="receipt-box">
                <div className="receipt-item">
                    <p className="receipt-label">TRANSACTION RECEIPT (Proof of Action):</p>
                    <div className="hash-display small">{txHash}</div>
                </div>
                
                {activeTab === 'new' && (
                    <div className="id-box">
                        <p className="id-label">✨ DOCUMENT ID (SAVE THIS FOR UPDATES):</p>
                        <div className="hash-display highlight">{docHash}</div>
                        <button className="copy-btn" onClick={() => copyToClipboard(docHash)}>Copy ID</button>
                    </div>
                )}
            </div>
            <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer" className="tx-link">View on Etherscan</a>
            <button className="btn btn-secondary start-over-btn" onClick={resetState}>Start Over</button>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;