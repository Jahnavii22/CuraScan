import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
import joblib
import os

# Step 1: Load dataset
data_path = os.path.join(os.path.dirname(__file__), "who_ranges.csv")
df = pd.read_csv(data_path)

# Step 2: Prepare data
# We'll predict if a test is more likely to indicate "low", "normal", or "high" based on ref ranges
# Add synthetic mid-value (average of lower and upper)
df["avg_ref"] = (df["lower_ref"] + df["upper_ref"]) / 2

# Create simple label for target
conditions = []
for i, row in df.iterrows():
    if row["flag_low"] == 1 and row["flag_high"] == 0:
        label = "low"
    elif row["flag_high"] == 1 and row["flag_low"] == 0:
        label = "high"
    else:
        label = "normal"
    conditions.append(label)

df["label"] = conditions

# Step 3: Select features
X = df[["lower_ref", "upper_ref", "avg_ref"]]
le = LabelEncoder()
y = le.fit_transform(df["label"])

# Step 4: Train model
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
model = RandomForestClassifier(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

accuracy = model.score(X_test, y_test)
print(f"✅ Model trained successfully! Accuracy: {accuracy:.2f}")

# Step 5: Save model & label encoder
model_path = os.path.join(os.path.dirname(__file__), "model.pkl")
encoder_path = os.path.join(os.path.dirname(__file__), "label_encoder.pkl")

joblib.dump(model, model_path)
joblib.dump(le, encoder_path)

print(f"💾 Saved model to: {model_path}")
print(f"💾 Saved label encoder to: {encoder_path}")
