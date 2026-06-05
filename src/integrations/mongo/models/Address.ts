import mongoose, { Schema, model, Document } from 'mongoose';

export interface IAddress extends Document {
  _id: string;
  user_id: string;
  full_name: string;
  mobile: string;
  house: string;
  area: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  is_default: boolean;
  created_at: Date;
}

const AddressSchema = new Schema<IAddress>({
  _id: { type: String, required: true },
  user_id: { type: String, required: true, index: true },
  full_name: { type: String, required: true },
  mobile: { type: String, required: true },
  house: { type: String, required: true },
  area: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  pincode: { type: String, required: true },
  landmark: { type: String },
  latitude: { type: Number },
  longitude: { type: Number },
  is_default: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
}, { _id: false, timestamps: false });

AddressSchema.index({ user_id: 1 });

export const Address = mongoose.models.Addresses || model<IAddress>('Addresses', AddressSchema);
