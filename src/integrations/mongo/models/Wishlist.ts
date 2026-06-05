import mongoose, { Schema, model, Document } from 'mongoose';

export interface IWishlist extends Document {
  _id: string;
  user_id: string;
  product_id: string;
  created_at: Date;
}

const WishlistSchema = new Schema<IWishlist>({
  _id: { type: String, required: true },
  user_id: { type: String, required: true, index: true },
  product_id: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
}, { _id: false, timestamps: false });

WishlistSchema.index({ user_id: 1, product_id: 1 }, { unique: true });

export const Wishlist = mongoose.models.Wishlists || model<IWishlist>('Wishlists', WishlistSchema);
