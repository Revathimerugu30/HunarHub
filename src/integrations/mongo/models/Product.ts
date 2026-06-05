import mongoose, { Schema, model, Document } from 'mongoose';

export interface IProduct extends Document {
  _id: string;
  id?: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  images: string[];
  colors?: string[];
  sizes?: string[];
  artisan_id: string;
  created_at: Date;
  updated_at: Date;
}

const ProductSchema = new Schema<IProduct>({
  _id: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, default: 0 },
  category: { type: String, required: true },
  images: [{ type: String }],
  colors: [{ type: String }],
  sizes: [{ type: String }],
  artisan_id: { type: String, required: true, index: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
}, { _id: false, timestamps: false });

ProductSchema.index({ artisan_id: 1 });
ProductSchema.index({ category: 1 });

export const Product = mongoose.models.Products || model<IProduct>('Products', ProductSchema);
