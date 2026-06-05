import mongoose, { Schema, model, Document } from 'mongoose';

export interface INotification extends Document {
  _id: string;
  user_id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: Date;
}

const NotificationSchema = new Schema<INotification>({
  _id: { type: String, required: true },
  user_id: { type: String, required: true, index: true },
  type: { type: String, required: true },
  title: { type: String, required: false },
  message: { type: String, required: true },
  link: { type: String, required: false },
  read: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
}, { _id: false, timestamps: false });

NotificationSchema.index({ user_id: 1, created_at: -1 });

export const Notification = mongoose.models.Notifications || model<INotification>('Notifications', NotificationSchema);
