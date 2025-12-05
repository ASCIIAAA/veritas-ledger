import sys
import json
import spacy
import re
import io

# Force UTF-8 for stdin/stdout to prevent encoding errors
sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8')
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    print(json.dumps({
        "score": 0, 
        "type": "Error", 
        "risks": [{"name": "Model Error", "status": "critical", "explanation": "Spacy model not found. Run: python -m spacy download en_core_web_sm"}], 
        "entities": []
    }))
    sys.exit(0)

# --- 1. REGEX PATTERNS ---
REGEX_PATTERNS = {
    "dates": [
        r'\b\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\b',
        r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b',
        r'\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b'
    ],
    "money": [
        r'[\$€£₹]\s?[\d,]+(\.\d{2})?',
        r'\b(?:Rs\.|INR)\s?[\d,]+',
        r'\b(?:unlimited|full)\s+financial\s+authority\b'
    ]
}

# --- 2. KNOWLEDGE BASE (LEVEL 1: ENHANCED REGEX) ---
DOC_KX = {
    "Board Resolution": {
        "keywords": [
            "board resolution", "resolved that", "board of directors", "meeting of the board", 
            "quorum", "agenda item", "certified true copy", "authrization to sign", 
            "issue of shares", "appointment of auditors", "company seal",
            "companies act", "shareholder approval", "special resolution"
        ],
        "red_flags": [
            r"\bnot\s+achieved\b", r"\bwithout\s+quorum\b", r"\bbackdated\b", 
            r"\brecorded\s+as\s+passed\b", r"\bdelegate\s+his\s+authority\b",   
            r"\bonly\s+one\s+signature\b", r"\bunlimited\s+financial\s+authority\b", 
            r"\bdirector\s+absent\s+but\s+marked\s+present\b", r"\bauthority\s+delegated\s+without\s+oversight\b"
        ]
    },
    "Memorandum of Understanding": {
        "keywords": [
            "memorandum of understanding", "mou", "collaboration", "mutual understanding",
            "partnership", "joint initiative", "joint venture", "ovjective", "scope of work", 
            "responsibilities of parties", "obligations", "cost-sharing", 
            "financial contribution", "non-binding"
        ],
        "red_flags": [
            r"\blegally\s+binding\b", r"\birrevocably\s+agree\b", r"\bpenalties\s+shall\s+be\s+imposed\b",
            r"\bunconditional\s+obligations\b", r"\bexclusive\s+rights\s+granted\s+to\b", 
            r"\bfailure\s+to\s+comply\s+will\s+result\s+in\s+legal\s+action\b"
        ]
    },
    "Annual Report": {
        "keywords": [
            "annual report", "financial statements", "auditor", "balance sheet",
            "revenue", "gross profit", "net income", "shareholder equity",
            "ebitda", "qualified opinion", "material misstatement",
            "auditor's report", "going concern", "risk management", "csr initiatives"
        ],
        "red_flags": [
            r"\bmaterial\s+misstatement\b", r"\bgoing\s+concern\s+is\s+uncertain\b", r"\bfraud\s+detected\b",
            r"\bmaterial\s+weakneses\s+found\b", r"\bunable\s+to\s+obtain\s+sufficient\s+audit\s+evidence\b",
            r"\bpending\s+investigation\b", r"\brestatement\s+of\s+financial\s+statements\b"
        ]
    },
    "Employment Contract": {
        "keywords": [
            "employment agreement", "probation period", "remuneration", "non-compete",
            "working hours", "salary", "benefits", "leave policy", "non solicitation",
            "code of conduct", "disciplinary actions", "designation", "termination clause"
        ],
        "red_flags": [
            r"\bwaives\s+all\s+legal\s+rights\b", r"\bwithout\s+notice\b", r"\bpenalty\s+for\s+resignation\b",
            r"\btermination\s+without\s+notice\b", r"\bnon-compete\s+for\s+more\s+than\s+two\s+years\b",
            r"\bcompany\s+is\s+not\s+responsible\s+for\s+workplace\s+injuries\b", r"\bsalary\s+may\s+be\s+withheld\b"
        ]
    },
    "Non-Disclosure Agreement": {
        "keywords": [
            "non-disclosure", "confidential information", "recipient shall not",
            "propritary data", "trade secrets", "recepient shall not disclose",
            "public domain", "return or destroy", "injunction relief", "survival clause"
        ],
        "red_flags": [
            r"\blasts\s+forever\b", r"\bno\s+exceptions\b", r"\bassumes\s+all\s+liability\b",
            r"\brecipient\s+assumes\s+all\s+liabilities\b", r"\bno\s+excpetions\s+to\s+confidentiality\b", 
            r"\bunlimited\s+penalities\b", r"\breceipient\s+grant\s+owernship\b", 
            r"\bdisclosure\s+allowed\s+to\s+affiliates\s+without\s+consent\b"
        ]
    }
}

def extract_regex_data(text):
    data = {}
    for label, patterns in REGEX_PATTERNS.items():
        matches = []
        for pat in patterns:
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

# --- LEVEL 2: CONTEXT AWARENESS (DEPENDENCY PARSING) ---
def is_phrase_negated(doc, start_char, end_char):
    span = doc.char_span(start_char, end_char, alignment_mode="expand")
    if span is None: return False
    root = span.root
    for child in root.children:
        if child.dep_ == 'neg': return True
    head = root.head
    for child in head.children:
        if child.dep_ == 'neg': return True
    return False

# --- FEATURE 1: GENERATE SUMMARY ---
def generate_summary(doc):
    # A simple rule-based summary: First 2 sentences + any sentence with key intent words
    summary_sentences = []
    
    # 1. Get all sentences
    sentences = list(doc.sents)
    
    if not sentences:
        return "No text content found to summarize."

    # 2. Always take the first 2 sentences (Introduction/Parties)
    if len(sentences) > 0:
        summary_sentences.append(sentences[0].text.strip())
    if len(sentences) > 1:
        summary_sentences.append(sentences[1].text.strip())
        
    # 3. Scan for "objective" or "purpose" sentences
    # We limit to 3 extra sentences to keep it short
    extras = 0
    for sent in sentences[2:]:
        txt = sent.text.lower()
        if any(w in txt for w in ["purpose", "whereas", "objective", "agrees as follows", "shall be"]):
            if extras < 3: 
                summary_sentences.append(sent.text.strip())
                extras += 1
    
    # Join and clean up
    summary_text = " ".join(summary_sentences)
    return summary_text if summary_text else "Summary could not be generated."

def analyze_contract(text):
    clean_text = " ".join(text.split())
    text_lower = clean_text.lower()
    nlp.max_length = 2000000 
    doc = nlp(clean_text[:100000]) 
    
    risks = []
    score = 100
    
    detected_type = detect_doc_type(text_lower)
    
    # --- RISK SCANNING LOGIC ---
    if detected_type in DOC_KX:
        for flag_pattern in DOC_KX[detected_type]["red_flags"]:
            for match in re.finditer(flag_pattern, text_lower):
                if is_phrase_negated(doc, match.start(), match.end()):
                    continue 
                risks.append({
                    "name": f"Critical Risk ({detected_type})",
                    "status": "warning",
                    "explanation": f"Detected risky clause: '{match.group()}'"
                })
                score -= 25 
                break 

    elif detected_type == "Unknown Document":
        score = 60
        risks.append({
            "name": "Unknown Document Type",
            "status": "warning",
            "explanation": "Document type not recognized. Automatic risk scanning may be limited."
        })
    
    entities = [ent.text for ent in doc.ents if ent.label_ in ["ORG", "PERSON"]]
    regex_data = extract_regex_data(clean_text)
    
    # --- FEATURE 2: CLAUSE CHECKLIST ---
    clause_checklist = []
    if detected_type in DOC_KX:
        keywords = DOC_KX[detected_type]["keywords"]
        for kw in keywords:
            # Check if keyword exists
            present = kw in text_lower
            if not present and len(clause_checklist) < 5:
                 clause_checklist.append(kw)

    summary = generate_summary(doc)
    return {
        "score": max(0, score),
        "type": detected_type,
        "risks": risks,
        "entities": list(set(entities)),
        "key_details": regex_data,
        "summary": summary,
        "missing_clauses": clause_checklist
    }

if __name__ == "__main__":
    try:
        input_text = sys.stdin.read()
        if not input_text:
            print(json.dumps({"score": 0, "type": "Error", "risks": [], "entities": [], "key_details": {}}))
        else:
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