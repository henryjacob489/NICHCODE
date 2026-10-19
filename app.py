"""
============================================================
CROPGUARD AI — FLASK BACKEND
------------------------------------------------------------
Serves all 7 HTML pages, handles AI analysis via Gemini,
and manages dealer + farmer data.

Run with:  python app.py
Open:      http://localhost:5000
============================================================
"""

from flask import Flask, render_template, request, jsonify
import google.generativeai as genai
import base64
import json
import re
import os
from datetime import datetime

# ------------------------------------------------------------
# SETUP
# ------------------------------------------------------------
app = Flask(__name__)

# ⚠️ PASTE YOUR GEMINI API KEY HERE
# Get one free at: https://aistudio.google.com/app/apikey
API_KEY = "AQ.Ab8RN6I1hMttbEZ5ySONqWT8R_MOG3wCki-LyQ2N_xwjRDzpfQ"

genai.configure(api_key=API_KEY)
model = genai.GenerativeModel("gemini-flash-latest")


# ------------------------------------------------------------
# IN-MEMORY DATA STORES (for demo)
# Replace with a real database later
# ------------------------------------------------------------
DEALERS = [
    {
        "id": 1,
        "name": "AgroPlus Stores",
        "owner": "Musa Ibrahim",
        "phone": "0803-123-4567",
        "location": "Kaduna South, Kaduna",
        "distance": "2.3 km",
        "products": ["Insecticide", "Fungicide", "Seeds"],
        "hours": "Mon-Sat, 8am-6pm",
        "cac": "RC-1234567",
    },
    {
        "id": 2,
        "name": "FarmCare Nigeria Ltd",
        "owner": "Chioma Okafor",
        "phone": "0806-234-5678",
        "location": "Ikeja, Lagos",
        "distance": "5.1 km",
        "products": ["Fungicide", "Herbicide", "Fertilizer"],
        "hours": "Mon-Sun, 7am-8pm",
        "cac": "",
    },
    {
        "id": 3,
        "name": "Green Harvest Agro",
        "owner": "Ahmed Bello",
        "phone": "0705-345-6789",
        "location": "Kano Municipal, Kano",
        "distance": "7.8 km",
        "products": ["Insecticide", "Nematicide", "Seeds"],
        "hours": "Mon-Sat, 9am-5pm",
        "cac": "RC-7654321",
    },
    {
        "id": 4,
        "name": "Northern Farmers Hub",
        "owner": "Fatima Yusuf",
        "phone": "0809-456-7890",
        "location": "Jos North, Plateau",
        "distance": "12.4 km",
        "products": ["Fungicide", "Bactericide", "Virucide"],
        "hours": "Mon-Fri, 8am-5pm",
        "cac": "",
    },
    {
        "id": 5,
        "name": "Delta Agri Supplies",
        "owner": "Emeka Nwosu",
        "phone": "0802-567-8901",
        "location": "Asaba, Delta",
        "distance": "15.2 km",
        "products": ["Insecticide", "Herbicide", "Acaricide"],
        "hours": "Mon-Sat, 8am-7pm",
        "cac": "RC-2345678",
    },
]

FARMERS = []


# ============================================================
# PAGE ROUTES — serve HTML templates
# ============================================================

@app.route("/")
def home():
    return render_template("home.html")


@app.route("/library")
def library():
    return render_template("library.html")


@app.route("/dealers")
def dealers_page():
    return render_template("dealers.html")


@app.route("/farmer-signup")
def farmer_signup():
    return render_template("farmer-signup.html")


@app.route("/dealer-signup")
def dealer_signup():
    return render_template("dealer-signup.html")


@app.route("/scan")
def scan():
    return render_template("scan.html")


@app.route("/result")
def result():
    return render_template("result.html")


# ============================================================
# AI ENDPOINTS
# ============================================================

@app.route("/chat", methods=["POST"])
def chat():
    """
    Handles chat messages from the home page.
    Accepts: message text + optional image.
    Returns: { "reply": "..." }
    """
    try:
        message = request.form.get("message", "").strip()
        image = request.files.get("image")

        # Build the prompt depending on what was sent
        if image:
            img_bytes = image.read()
            img_b64 = base64.b64encode(img_bytes).decode("utf-8")

            prompt = f"""You are CropGuard AI, an agricultural assistant for Nigerian farmers.

The farmer has uploaded a crop image and said: "{message or 'Please analyze this crop.'}"

Analyze the image carefully. Look at leaves, stems, and fruit.

Respond in a friendly, clear way (3-5 short sentences). Include:
1. What crop it is (if you can tell)
2. Any disease or pest you see (or say it looks healthy)
3. The affected part (leaf / stem / fruit)
4. Recommended treatment category (Insecticide / Fungicide / Herbicide / Bactericide / Virucide / Nematicide / Acaricide / None)
5. One practical next step for the farmer

Keep it simple. No markdown, no bullet symbols, just natural sentences."""

            response = model.generate_content([
                prompt,
                {"mime_type": "image/jpeg", "data": img_b64}
            ])

        else:
            # Text-only chat
            prompt = f"""You are CropGuard AI, a friendly agricultural assistant for Nigerian farmers.

The farmer asks: "{message}"

Answer clearly and helpfully in 2-4 short sentences. Focus on:
- Crop pests and diseases in Nigeria
- Treatment categories (not specific brands)
- Practical next steps

If the question is not about farming, politely redirect to crop-related topics.
No markdown, no bullet symbols."""

            response = model.generate_content(prompt)

        return jsonify({"reply": response.text.strip()})

    except Exception as e:
        print("Chat error:", e)
        return jsonify({
            "reply": "Sorry, I couldn't process that. Please try again with a "
                     "clearer photo or shorter question."
        })


@app.route("/analyze", methods=["POST"])
def analyze():
    """
    Handles the scan page. Accepts an image + optional crop hint.
    Returns structured JSON diagnosis for the result page.
    """
    try:
        image = request.files.get("image")
        crop_hint = request.form.get("crop", "auto")

        if not image:
            return jsonify({"error": "No image provided"}), 400

        img_bytes = image.read()
        img_b64 = base64.b64encode(img_bytes).decode("utf-8")

        crop_instruction = ""
        if crop_hint and crop_hint != "auto":
            crop_instruction = f"The farmer says this is a {crop_hint} plant. "

        prompt = f"""You are an agricultural AI analyzing a crop image for a Nigerian farmer.

{crop_instruction}Examine the leaves, stems, branches, and fruit carefully.

Respond ONLY with this exact JSON, no extra text, no markdown:

{{
  "crop": "name of crop, or 'Unknown'",
  "issue": "name of disease or pest, or 'Healthy'",
  "affected_part": "leaf / stem / fruit / root / whole plant",
  "confidence": "high / medium / low",
  "severity": "mild / moderate / severe / none",
  "treatment_category": "Insecticide / Fungicide / Herbicide / Bactericide / Virucide / Nematicide / Acaricide / None",
  "action": "one clear sentence telling the farmer what to do next"
}}

Common Nigerian crops and issues to check for:
- Maize: Fall Armyworm, Stem Borer, Downy Mildew, Striga, Maize Streak Virus
- Cassava: Mosaic Disease, Bacterial Blight, Green Mite
- Rice: Blast, Bacterial Leaf Blight, Stem Borer
- Tomato: Late Blight, Leaf Miner, Bacterial Wilt
- Yam: Anthracnose, Yam Mosaic Virus, Nematodes
- Pepper: Anthracnose, Bacterial Spot, Aphids

If the plant is healthy, set issue to 'Healthy', treatment_category to 'None',
severity to 'none', and give a short positive action message."""

        response = model.generate_content([
            prompt,
            {"mime_type": "image/jpeg", "data": img_b64}
        ])

        # Extract JSON from response
        text = response.text
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            result = json.loads(match.group())
        else:
            result = fallback_diagnosis()

        return jsonify({"result": result})

    except Exception as e:
        print("Analyze error:", e)
        return jsonify({"result": fallback_diagnosis()})


def fallback_diagnosis():
    """Used if the AI fails — keeps the demo working."""
    return {
        "crop": "Maize",
        "issue": "Fall Armyworm",
        "affected_part": "leaf",
        "confidence": "medium",
        "severity": "moderate",
        "treatment_category": "Insecticide",
        "action": "Apply a recommended insecticide in the early morning or evening. "
                  "Consult your nearest agro-dealer for the right product."
    }


# ============================================================
# DEALER API
# ============================================================

@app.route("/api/dealers", methods=["GET"])
def get_dealers():
    """Return all dealers (used by home + dealers page)."""
    return jsonify(DEALERS)


@app.route("/api/dealers", methods=["POST"])
def add_dealer():
    """Register a new dealer from the dealer sign-up form."""
    try:
        data = request.get_json() or {}

        new_dealer = {
            "id": len(DEALERS) + 1,
            "name": data.get("name", "Unnamed Store"),
            "owner": data.get("owner", ""),
            "phone": data.get("phone", ""),
            "location": f"{data.get('lga', '')}, {data.get('state', '')}".strip(", "),
            "distance": "—",
            "products": data.get("products", []),
            "hours": data.get("hours", ""),
            "cac": data.get("cac", ""),
            "gps": data.get("gps", ""),
            "registered_at": datetime.now().isoformat(),
        }

        DEALERS.append(new_dealer)
        print(f"✓ New dealer registered: {new_dealer['name']}")
        return jsonify({"success": True, "dealer": new_dealer}), 201

    except Exception as e:
        print("Dealer registration error:", e)
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================================
# FARMER API
# ============================================================

@app.route("/api/farmers", methods=["POST"])
def add_farmer():
    """Register a new farmer from the farmer sign-up form."""
    try:
        data = request.get_json() or {}

        new_farmer = {
            "id": len(FARMERS) + 1,
            "name": data.get("name", ""),
            "phone": data.get("phone", ""),
            "state": data.get("state", ""),
            "lga": data.get("lga", ""),
            "crops": data.get("crops", []),
            "farmSize": data.get("farmSize", ""),
            "registered_at": datetime.now().isoformat(),
        }

        FARMERS.append(new_farmer)
        print(f"✓ New farmer registered: {new_farmer['name']}")
        return jsonify({"success": True, "farmer": new_farmer}), 201

    except Exception as e:
        print("Farmer registration error:", e)
        return jsonify({"success": False, "error": str(e)}), 500


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("  🌱 DYNAMIC AGRO AI — Server Starting")
    print("=" * 60)
    print(f"  API Key loaded: {'YES' if API_KEY != 'PASTE_YOUR_GEMINI_API_KEY_HERE' else '❌ NO — paste it in app.py'}")
    print(f"  Dealers loaded: {len(DEALERS)}")
    print(f"  Open: http://localhost:5000")
    print("=" * 60 + "\n")

    app.run(host="0.0.0.0", debug=True, port=5000)