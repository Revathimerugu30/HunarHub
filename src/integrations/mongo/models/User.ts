import mongoose, { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  _id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: 'customer' | 'artisan' | 'admin';
  city?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  blocked: boolean;
  created_at: Date;
  updated_at: Date;
}

const UserSchema = new Schema<IUser>(
  {
    _id: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password_hash: { type: String, required: true },
    full_name: { type: String, required: true },
    role: { type: String, enum: ['customer', 'artisan', 'admin'], default: 'customer' },
    city: { type: String },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
    blocked: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { _id: false, timestamps: false }
);

UserSchema.index({ email: 1 });

export const User = mongoose.models.Users || model<IUser>('Users', UserSchema);
