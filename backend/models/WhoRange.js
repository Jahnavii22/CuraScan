import mongoose from "mongoose";

const whoSchema = new mongoose.Schema({
  test_name: String,
  category: String,
  unit: String,
  sex: String,
  lower_ref: Number,
  upper_ref: Number,
  flag_low: { type: Number, default: 1 },
  flag_high: { type: Number, default: 1 }
});

export const WhoRange = mongoose.model("WhoRange", whoSchema);
