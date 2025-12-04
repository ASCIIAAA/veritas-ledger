import React, { useState } from 'react';
import { ethers } from 'ethers';
import './App.css';

// --- ICONS ---
const UploadIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>);

// --- BLOCKCHAIN CONFIG ---
// ⚠️ IMPORTANT: Replace this with the address of your NEW 'DocumentLedger' contract
const CONTRACT_ADDRESS = "0x62f6bBB2e20707dce3bA7078A7d1ce3126Fb7Fb7"; 

const CONTRACT_ABI = [
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
];

function App() {
  // --- UI STATE ---
  const [activeTab, setActiveTab] = useState('create'); // 'create', 'update', 'verify'
  
  // --- DATA STATE ---
  const [file, setFile] = useState(null);
  
  // Analysis Results
  const [docHash, setDocHash] = useState('');
  const [docType, setDocType] = useState('');
  const [score, setScore] = useState(0);
  const [risks, setRisks] = useState([]);
  const [keyDetails, setKeyDetails] = useState({});

  // Blockchain Inputs
  const [originalDocId, setOriginalDocId] = useState('');
  const [latestHash, setLatestHash] = useState('');
  
  // Status
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // --- 1. AI ANALYSIS ENGINE ---
  const processDocument = async (selectedFile) => {
    setIsLoading(true);
    setStatus('Analyzing document...');
    
    const formData = new FormData();
    formData.append('pdf', selectedFile);

    try {
       const response = await fetch('http://localhost:3001/analyze', {
        method: 'POST',
        body: formData,
       });
       
       if (!response.ok) throw new Error('Server analysis failed');
       const data = await response.json();
       
       setDocHash(data.docHash);
       setRisks(data.risks);
       setDocType(data.type);
       setScore(data.score);
       setKeyDetails(data.key_details || {});
       
       setStatus('Analysis Complete.');
    } catch (err) {
        console.error(err);
        setStatus('Error: Backend server not reachable.');
    } finally {
        setIsLoading(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
        setFile(e.target.files[0]);
        processDocument(e.target.files[0]);
    }
  };

  // --- 2. BLOCKCHAIN ACTIONS ---
  const getContract = async () => {
      if (!window.ethereum) throw new Error("MetaMask not found");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
  };

  const handleCreate = async () => {
      try {
          setIsLoading(true);
          const contract = await getContract();
          // Use the Hash as the ID for the first version
          const tx = await contract.createDocument(docHash, docHash);
          setStatus("Waiting for confirmation...");
          await tx.wait();
          setStatus(`Success! Document ID: ${docHash}`);
      } catch (err) {
          console.error(err);
          setStatus("Error: " + (err.reason || err.message));
      } finally { setIsLoading(false); }
  };

  const handleUpdate = async () => {
      if (!originalDocId) return setStatus("Please enter Original Document ID");
      try {
          setIsLoading(true);
          const contract = await getContract();
          const tx = await contract.updateDocument(originalDocId, docHash);
          setStatus("Waiting for confirmation...");
          await tx.wait();
          setStatus("Success! New version linked on blockchain.");
      } catch (err) {
          console.error(err);
          setStatus("Error: " + (err.reason || err.message));
      } finally { setIsLoading(false); }
  };

  const handleVerify = async () => {
      if (!originalDocId) return setStatus("Please enter Document ID");
      try {
          setIsLoading(true);
          const contract = await getContract();
          const result = await contract.getLatestHash(originalDocId);
          setLatestHash(result);
          setStatus("Blockchain query successful.");
      } catch (err) {
          console.error(err);
          setStatus("Error: " + (err.reason || err.message));
      } finally { setIsLoading(false); }
  };

  return (
    <div className="container">
      <header className="header">
        <div className="logo"><h1>Veritas Ledger</h1></div>
        <div className="nav">
            <button onClick={() => {setActiveTab('create'); setStatus('')}} className={activeTab === 'create' ? 'active-tab' : ''}>New Document</button>
            <button onClick={() => {setActiveTab('update'); setStatus('')}} className={activeTab === 'update' ? 'active-tab' : ''}>Update Version</button>
            <button onClick={() => {setActiveTab('verify'); setStatus('')}} className={activeTab === 'verify' ? 'active-tab' : ''}>Verify Hash</button>
        </div>
      </header>

      <main className={`main-content ${docHash ? 'content-top' : ''}`}>
        <h2 style={{ marginBottom: "1rem", color: "var(--text-muted)", fontSize:"1.2rem" }}>
    {activeTab === 'update' ? 'Upload New Version' : 'Upload Document'}
</h2>

        {/* --- UPLOAD SECTION (For Create & Update) --- */}
        {(activeTab === 'create' || activeTab === 'update') && (
            <div className={`upload-section ${docHash ? 'full' : ''}`}>
                {activeTab === 'update' && (
                    <input 
                        type="text" 
                        placeholder="Paste Original Document ID (Hash)" 
                        className="input-field"
                        value={originalDocId}
                        onChange={(e) => setOriginalDocId(e.target.value)}
                    />
                )}
                
                <div className="dropzone">
                    <UploadIcon />
                    <p>Upload {activeTab === 'update' ? 'New Version' : 'PDF Document'}</p>
                    <input type="file" onChange={handleFileChange} />
                </div>

                {/* RESULTS CARD */}
                {docHash && (
                    <div className="analysis-result">
                        <h3>AI Analysis Report</h3>
                        
                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            {/* We pass the score as a CSS variable for the chart */}
                            <div className="score-badge" style={{ "--score": score }}>
                                <span className="score-value">{score}</span>
                            </div>
                            <span style={{ color: '#b3b3b3', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                                Safety Score
                            </span>
                        </div>

                        {/* RISKS */}
                        <div className="risks-container">
                            <h4>⚠️ Detected Risks</h4>
                            {risks.length > 0 ? (
                                <ul className="risk-list">
                                    {risks.map((risk, index) => (
                                        <li key={index} className="risk-item">
                                            <span style={{fontSize: '1.2rem', marginRight: '10px'}}>
                                                {risk.status === 'critical' ? '❌' : '⚠️'}
                                            </span>
                                            <div>
                                                <strong style={{color: '#fca5a5'}}>{risk.name}</strong>
                                                <p style={{color: '#e2e8f0', fontSize: '0.9rem'}}>{risk.explanation}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="safe-message">✅ No specific risks detected.</p>
                            )}
                        </div>

                        {/* REGEX DETAILS */}
                        {(keyDetails.dates?.length > 0 || keyDetails.money?.length > 0) && (
                            <div className="key-details">
                                <h4>📄 Extracted Details</h4>
                                <ul>
                                    {keyDetails.dates?.map(d => <li key={d}>📅 {d}</li>)}
                                    {keyDetails.money?.map(m => <li key={m}>💰 {m}</li>)}
                                </ul>
                            </div>
                        )}

                        <div className="hash-display">
                            <span style={{color: '#6b7280', fontSize: '0.8em'}}>New Hash:</span><br/>
                            {docHash}
                        </div>
                        
                        <button className="btn btn-primary" onClick={activeTab === 'create' ? handleCreate : handleUpdate} disabled={isLoading}>
                            {isLoading ? "Processing..." : (activeTab === 'create' ? "Notarize on Blockchain" : "Update Blockchain Record")}
                        </button>
                    </div>
                )}
            </div>
        )}

        {/* --- VERIFY SECTION --- */}
        {activeTab === 'verify' && (
            <div className="verify-section">
                <h2>Check Latest Version</h2>
                <input 
                    type="text" 
                    placeholder="Enter Document ID (Original Hash)" 
                    className="input-field"
                    value={originalDocId}
                    onChange={(e) => setOriginalDocId(e.target.value)}
                />
                <button className="btn btn-secondary" onClick={handleVerify}>Get Latest Hash</button>
                
                {latestHash && (
                    <div className="result-box">
                        <h4>Blockchain Result</h4>
                        <p>Latest Valid Hash: <br/><code>{latestHash}</code></p>
                    </div>
                )}
            </div>
        )}

        {status && <p className="status-msg">{status}</p>}
      </main>
    </div>
  );
}

export default App;