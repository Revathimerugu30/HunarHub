import mongoose, { Schema, model, Document } from 'mongoose';

export interface IArtisanProfile extends Document {
  _id?: string;
  artisan_id: string;
  workshop_name?: string;
  workshop_address?: string;
  workshop_latitude?: number;
  workshop_longitude?: number;
  bio?: string;
  skills?: string[];
  experience_years?: number;
  available: boolean;
  verified: boolean;
  avatar_url?: string;
  updated_at: Date;
}

const ArtisanProfileSchema = new Schema<IArtisanProfile>({
  artisan_id: { type: String, required: true, unique: true },
  workshop_name: { type: String },
  workshop_address: { type: String },
  workshop_latitude: { type: Number },
  workshop_longitude: { type: Number },
  bio: { type: String },
  skills: [{ type: String }],
  experience_years: { type: Number, default: 0 },
  available: { type: Boolean, default: true },
  verified: { type: Boolean, default: false },
  avatar_url: { type: String },
  updated_at: { type: Date, default: Date.now },
});

ArtisanProfileSchema.index({ artisan_id: 1 });

export const ArtisanProfile = mongoose.models.ArtisanProfiles || model<IArtisanProfile>('ArtisanProfiles', ArtisanProfileSchema);
