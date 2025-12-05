import joblib
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import make_pipeline
import os
from docx import Document

BASE_DIR = os.path.dirname(__file__)
filepath = os.path.join(BASE_DIR, "Corporate_docs_keywords_NLP.docx")

print("Looking for:", filepath)
doc = Document(filepath)
data = []

safe_heading = ["Core Keywords", "Employment Basics", "Legal Clauses", "Policies",
                "Confidential Information", "Obligations", "Exceptions", "Legal"]

risky_heading = ["Red-Flag Statements", "BONUS: Universal Red Flags Across All Corporate Docs"]

current_label = None

for para in doc.paragraphs:
    text = para.text.strip()

    if text in safe_heading:
        current_label = "SAFE"
        continue
    if text in risky_heading:
        current_label = "RISKY"
        continue

    if text.startswith("•") and len(text) > 2:
        clean = text.replace("•", "").strip()
        data.append((clean, current_label))

X, y = zip(*data)

model = make_pipeline(CountVectorizer(), MultinomialNB())
model.fit(X, y)

joblib.dump(model, "legal_model.pkl")

print("Training complete! Model saved as legal_model.pkl")

print("Test: 'Unlimited liability': ", model.predict(["Unlimited liability"])[0])
print("Test: 'Termination clause with notice': ", model.predict(["Termination clause with notice"])[0])
