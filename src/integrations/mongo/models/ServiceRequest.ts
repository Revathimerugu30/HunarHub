import mongoose, { Schema, model, Document } from 'mongoose';

export interface IServiceRequest extends Document {
  _id: string;
  customer_id: string;
  artisan_id?: string;
  description: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

const ServiceRequestSchema = new Schema<IServiceRequest>({
  _id: { type: String, required: true },
  customer_id: { type: String, required: true, index: true },
  artisan_id: { type: String, index: true },
  description: { type: String, required: true },
  status: { type: String, default: 'open', enum: ['open', 'accepted', 'completed', 'cancelled'] },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
}, { _id: false, timestamps: false });

ServiceRequestSchema.index({ customer_id: 1, status: 1 });

export const ServiceRequest = mongoose.models.ServiceRequests || model<IServiceRequest>('ServiceRequests', ServiceRequestSchema);
