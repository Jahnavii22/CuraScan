# backend/ml/train_model.py
import pandas as pd
import numpy as np
import os
import joblib
from sklearn.model_selection import train_test_split, StratifiedKFold, RandomizedSearchCV
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.ensemble import RandomForestClassifier, StackingClassifier
from sklearn.linear_model import LogisticRegression
from xgboost import XGBClassifier
from sklearn.metrics import classification_report, confusion_matrix
from imblearn.over_sampling import SMOTE

BASE_DIR = os.path.dirname(__file__)
DATA_PATH = os.path.join(BASE_DIR, "synthetic_training.csv")
MODEL_OUT = os.path.join(BASE_DIR, "model.pkl")
ENC_OUT = os.path.join(BASE_DIR, "label_encoder.pkl")
SCALER_OUT = os.path.join(BASE_DIR, "scaler.pkl")

def load_data():
    df = pd.read_csv(DATA_PATH)
    df = df.dropna(subset=["value", "ref_lower", "ref_upper"])
    return df

def make_features(df):
    X = df[["value", "ref_lower", "ref_upper", "pct_of_range", "distance_lower", "distance_upper"]].values
    return X

def main():
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(DATA_PATH + " not found. Run generate_training_data.py first.")
    df = load_data()
    X = make_features(df)
    le = LabelEncoder()
    y = le.fit_transform(df["label"].astype(str))

    X_train, X_test, y_train, y_test = train_test_split(X, y, stratify=y, test_size=0.2, random_state=42)

    sm = SMOTE(random_state=42)
    X_train_res, y_train_res = sm.fit_resample(X_train, y_train)

    scaler = StandardScaler()
    X_train_res = scaler.fit_transform(X_train_res)
    X_test_scaled = scaler.transform(X_test)

    rf = RandomForestClassifier(random_state=42, n_jobs=-1)
    xgb = XGBClassifier(use_label_encoder=False, eval_metric="mlogloss", random_state=42, n_jobs=-1)

    rf_param = {
        "n_estimators": [100, 200],
        "max_depth": [None, 6, 12],
        "min_samples_split": [2, 5]
    }
    xgb_param = {
        "n_estimators": [100, 200],
        "max_depth": [3, 6],
        "learning_rate": [0.01, 0.05, 0.1],
        "subsample": [0.7, 0.9, 1.0]
    }

    skf = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)

    print("Running RandomizedSearchCV for XGBoost...")
    xgb_search = RandomizedSearchCV(xgb, xgb_param, n_iter=8, cv=skf, scoring="f1_macro", n_jobs=-1, random_state=42, verbose=1)
    xgb_search.fit(X_train_res, y_train_res)
    best_xgb = xgb_search.best_estimator_
    print("XGB best params:", xgb_search.best_params_)

    print("Running RandomizedSearchCV for RandomForest...")
    rf_search = RandomizedSearchCV(rf, rf_param, n_iter=6, cv=skf, scoring="f1_macro", n_jobs=-1, random_state=42, verbose=1)
    rf_search.fit(X_train_res, y_train_res)
    best_rf = rf_search.best_estimator_
    print("RF best params:", rf_search.best_params_)

    estimators = [("rf", best_rf), ("xgb", best_xgb)]
    stack = StackingClassifier(estimators=estimators, final_estimator=LogisticRegression(max_iter=1000), n_jobs=-1)

    print("Training stacking classifier...")
    stack.fit(X_train_res, y_train_res)

    preds = stack.predict(X_test_scaled)
    print("=== Classification Report ===")
    print(classification_report(y_test, preds, target_names=le.classes_))
    print("Confusion Matrix:")
    print(confusion_matrix(y_test, preds))

    joblib.dump(stack, MODEL_OUT)
    joblib.dump(le, ENC_OUT)
    joblib.dump(scaler, SCALER_OUT)
    print("Saved model artifacts:")
    print(" -", MODEL_OUT)
    print(" -", ENC_OUT)
    print(" -", SCALER_OUT)

if __name__ == "__main__":
    main()
