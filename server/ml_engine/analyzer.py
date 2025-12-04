import sys
import json
import spacy

# Load NLP model (standard English)
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    print(json.dumps({"error": "Model not found. Run: python -m spacy download en_core_web_sm"}))
    sys.exit(1)

DOC_KX = {
    "Memorandum of Understanding": {
        "keywords": [
            "mutual understanding", "partnership", "collaboration", "joint initiative", 
            "objective", "scope of work", "responsibilities of parties", "obligations", 
            "cost-sharing", "financial contribution", "non-binding"
        ],
        "red_flags": [
            "this mou is legally binding", 
            "irrevocably agree", 
            "unconditional obligations", 
            "penalties shall be imposed", 
            "exclusive rights granted to", 
            "failure to comply will result in legal action"
        ]
    },
    "Board Resolution": {
        "keywords": [
            "resolved that", "board of directors", "meeting of the board", "chairperson", 
            "quorum", "agenda item", "authorization to sign", "issue of shares", 
            "appointment of auditors", "company seal", "companies act"
        ],
        "red_flags": [
            "approved without quorum", 
            "resolution passed without meeting", 
            "backdated approval", 
            "director absent but recorded present", 
            "authority delegated without oversight"
        ]
    },
    "Annual Report": {
        "keywords": [
            "revenue", "gross profit", "ebitda", "net income", "shareholder equity", 
            "qualified opinion", "material misstatement", "auditor’s report", 
            "going concern", "risk management", "csr initiatives"
        ],
        "red_flags": [
            "going concern is uncertain", 
            "material weaknesses found", 
            "significant fraud detected", 
            "unable to obtain sufficient audit evidence", 
            "pending investigation", 
            "restatement of financial statements"
        ]
    },
    "Employment Contract": {
        "keywords": [
            "probation period", "working hours", "salary", "benefits", "non-compete", 
            "non-solicitation", "code of conduct", "leave policy", "disciplinary action", 
            "designation"
        ],
        "red_flags": [
            "employee waives all legal rights", 
            "termination without notice", 
            "non-compete for more than 2 years", 
            "company is not responsible for workplace injuries", 
            "salary may be withheld", 
            "pay penalty for resignation"
        ]
    },
    "Non-Disclosure Agreement": {
        "keywords": [
            "confidential information", "proprietary data", "trade secrets", 
            "recipient shall not disclose", "public domain", "return or destroy", 
            "injunction relief", "survival clause"
        ],
        "red_flags": [
            "nda lasts forever", 
            "recipient assumes all liability", 
            "no exceptions to confidentiality", 
            "unlimited penalties", 
            "recipient grants ownership", 
            "disclosure allowed to affiliates without consent"
        ]
    }
}

UNIVERSAL_FLAGS = [
    "irrevocable", "perpetual obligation", "without limitation", 
    "waives all rights", "unlimited liability", "records destroyed", 
    "unable to provide documentation", "self-dealing", 
    "beneficiary is related to director", "fraudulent activity", 
    "pending legal proceedings"
]

def detect_doc_type(text_lower):
    """
    Classifies the document based on which category has the most keyword matches.
    """
    scores = {dtype: 0 for dtype in DOC_KX}
    
    for dtype, data in DOC_KX.items():
        for keyword in data["keywords"]:
            if keyword in text_lower:
                scores[dtype] += 1
    
    # Get the category with the highest score
    best_match = max(scores, key=scores.get)
    
    # If no keywords match at all, return Unknown
    if scores[best_match] == 0:
        return "Unknown Document"
    
    return best_match

def analyze_contract(text):
    doc = nlp(text)
    text_lower = text.lower()
    
    risks = []
    score = 100
    
    # 1. Classification
    detected_type = detect_doc_type(text_lower)
    
    # 2. Universal Risk Scan
    for flag in UNIVERSAL_FLAGS:
        if flag in text_lower:
            risks.append({
                "name": "Universal High Risk",
                "status": "critical",
                "explanation": f"CRITICAL: Found highly dangerous phrase: '{flag}'."
            })
            score -= 20

    # 3. Context-Specific Risk Scan
    if detected_type in DOC_KX:
        # Check specific red flags for this document type
        specific_flags = DOC_KX[detected_type]["red_flags"]
        for flag in specific_flags:
            if flag in text_lower:
                risks.append({
                    "name": f"{detected_type} Risk",
                    "status": "warning",
                    "explanation": f"Flagged potentially dangerous clause: '{flag}'."
                })
                score -= 15
    else:
        # If unknown, we can't do specific checks, so we deduct a small confidence score
        score -= 10
        risks.append({
            "name": "Unknown Document Type",
            "status": "warning",
            "explanation": "Could not automatically classify document type. Standard analysis applied."
        })

    # 4. Entity Extraction (to make it look cool/useful)
    # Extracts Organizations (ORG) and Money (MONEY) mentioned
    entities = [ent.text for ent in doc.ents if ent.label_ in ["ORG", "MONEY"]]

    return {
        "score": max(0, score),
        "type": detected_type,
        "risks": risks,
        "entities": list(set(entities))
    }

if __name__ == "__main__":
    try:
        # Read input from Node.js
        input_text = sys.argv[1]
        result = analyze_contract(input_text)
        print(json.dumps(result))
    except Exception as e:
        # Fallback error handling
        print(json.dumps({
            "score": 0, 
            "type": "Error", 
            "risks": [{"name": "System Error", "status": "critical", "explanation": str(e)}],
            "entities": []
        }))