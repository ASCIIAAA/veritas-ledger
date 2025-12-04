import sys
import json
import spacy
import re

# Load NLP model
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    print(json.dumps({"error": "Model not found."}))
    sys.exit(1)

# --- 1. IMPROVED REGEX PATTERNS ---
# Updated to catch "5TH FEBRUARY 2024" and "15TH JANUARY 2024"
REGEX_PATTERNS = {
    "dates": [
        # Catch: 5th February 2024, 15TH JANUARY 2024
        r'\b\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b',
        # Catch: January 5, 2024
        r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b',
        # Catch: 05/02/2024 or 2024-02-05
        r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b'
    ],
    "money": [
        r'[\$€£₹]\s?[\d,]+(\.\d{2})?',
        r'\b(?:Rs\.|INR)\s?[\d,]+',
        r'\b(?:unlimited|full)\s+financial\s+authority\b' # Catch generic money authority
    ]
}

# --- 2. REFINED KNOWLEDGE BASE ---
# Using shorter phrases to avoid mismatches due to PDF formatting
DOC_KX = {
    "Board Resolution": {
        "keywords": [
            "board resolution", "resolved that", "board of directors", "meeting of the board", 
            "quorum", "agenda item", "certified true copy"
        ],
        "red_flags": [
            "not achieved",             # Catches "Quorum: Not achieved"
            "without quorum",           # Catches "meeting... without quorum"
            "backdated",                # Catches "hereby backdated"
            "recorded as passed",       # Administrative convenience
            "delegate his authority",   # Unchecked delegation
            "only one signature",
            "unlimited financial authority"
        ]
    },
    "Memorandum of Understanding": {
        "keywords": ["memorandum of understanding", "mou", "mutual understanding", "collaboration"],
        "red_flags": ["legally binding", "irrevocably agree", "penalties shall be imposed"]
    },
    "Annual Report": {
        "keywords": ["annual report", "financial statements", "auditor", "balance sheet"],
        "red_flags": ["material misstatement", "going concern is uncertain", "fraud detected"]
    },
    "Employment Contract": {
        "keywords": ["employment agreement", "probation period", "remuneration", "non-compete"],
        "red_flags": ["waives all legal rights", "without notice", "penalty for resignation"]
    },
    "Non-Disclosure Agreement": {
        "keywords": ["non-disclosure", "confidential information", "recipient shall not"],
        "red_flags": ["lasts forever", "no exceptions", "assumes all liability"]
    }
}

def extract_regex_data(text):
    data = {}
    # Combine patterns for each type
    for label, patterns in REGEX_PATTERNS.items():
        matches = []
        for pat in patterns:
            # Case insensitive search for better matching
            found = re.findall(pat, text, re.IGNORECASE)
            matches.extend(found)
        data[label] = list(set(matches))
    return data

def detect_doc_type(text_lower):
    scores = {dtype: 0 for dtype in DOC_KX}
    
    for dtype, data in DOC_KX.items():
        for keyword in data["keywords"]:
            if keyword in text_lower:
                scores[dtype] += 1
    
    best_match = max(scores, key=scores.get)
    return best_match if scores[best_match] > 0 else "Unknown Document"

def analyze_contract(text):
    # --- CRITICAL: NORMALIZE TEXT ---
    # Removes newlines inside sentences that break phrase matching
    # "BOARD \n RESOLUTION" becomes "BOARD RESOLUTION"
    clean_text = " ".join(text.split())
    text_lower = clean_text.lower()
    
    doc = nlp(clean_text)
    
    risks = []
    score = 100
    
    # 1. Classification
    detected_type = detect_doc_type(text_lower)
    
    # 2. Risk Scan
    if detected_type in DOC_KX:
        # Check specific red flags
        for flag in DOC_KX[detected_type]["red_flags"]:
            if flag in text_lower:
                risks.append({
                    "name": f"Critical Risk ({detected_type})",
                    "status": "warning",
                    "explanation": f"Detected risky clause: '{flag}'"
                })
                score -= 25 # Heavy penalty for specific red flags
    
    # 3. Regex Extraction
    regex_data = extract_regex_data(clean_text)
    
    # 4. Entity Extraction (People/Orgs)
    entities = [ent.text for ent in doc.ents if ent.label_ in ["ORG", "PERSON"]]

    return {
        "score": max(0, score),
        "type": detected_type,
        "risks": risks,
        "entities": list(set(entities)),
        "key_details": regex_data
    }

if __name__ == "__main__":
    try:
        # 1. Handle potential encoding issues from Node.js
        sys.stdin.reconfigure(encoding='utf-8')
        input_text = sys.argv[1]
        
        # 2. Run Analysis
        result = analyze_contract(input_text)
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            "score": 0, 
            "type": "Error", 
            "risks": [{"name": "System Error", "status": "critical", "explanation": str(e)}],
            "entities": [],
            "key_details": {}
        }))