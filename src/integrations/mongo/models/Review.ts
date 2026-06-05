import mongoose, { Schema, model, Document } from 'mongoose';

export interface IReview extends Document {
  _id: string;
  artisan_id: string;
  customer_id: string;
  rating: number;
  comment: string;
  created_at: Date;
}

const ReviewSchema = new Schema<IReview>({
  _id: { type: String, required: true },
  artisan_id: { type: String, required: true, index: true },
  customer_id: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String },
  created_at: { type: Date, default: Date.now },
}, { _id: false, timestamps: false });

ReviewSchema.index({ artisan_id: 1, created_at: -1 });

export const Review = mongoose.models.Reviews || model<IReview>('Reviews', ReviewSchema);
