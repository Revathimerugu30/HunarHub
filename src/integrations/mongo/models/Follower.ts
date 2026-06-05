import mongoose, { Schema, model, Document } from 'mongoose';

export interface IFollower extends Document {
  _id: string;
  follower_id: string;
  artisan_id: string;
  created_at: Date;
}

const FollowerSchema = new Schema<IFollower>({
  _id: { type: String, required: true },
  follower_id: { type: String, required: true, index: true },
  artisan_id: { type: String, required: true, index: true },
  created_at: { type: Date, default: Date.now },
}, { _id: false, timestamps: false });

FollowerSchema.index({ follower_id: 1, artisan_id: 1 }, { unique: true });

export const Follower = mongoose.models.Followers || model<IFollower>('Followers', FollowerSchema);
