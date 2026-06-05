import mongoose, { Schema, model, Document } from 'mongoose';

export interface IOrder extends Document {
  _id: string;
  customer_id: string;
  artisan_id: string;
  product_id: string;
  addressId?: string;
  quantity: number;
  product_price: number;
  total_price: number;
  order_status: string;
  tracking_status: string;
  payment_status: string;
  estimated_delivery_date?: Date;
  expectedDeliveryTime?: Date;
  customerLocation?: {
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
  };
  artisanLocation?: {
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
  };
  deliveryDistanceKm?: number;
  distanceKm?: number;
  trackingHistory?: Array<{ status: string; time: Date; location?: { latitude?: number; longitude?: number } }>;
  address: {
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
  };
  created_at: Date;
  updated_at: Date;
}

const OrderSchema = new Schema<IOrder>({
  _id: { type: String, required: true },
  customer_id: { type: String, required: true, index: true },
  artisan_id: { type: String, required: true, index: true },
  product_id: { type: String, required: true },
  addressId: { type: String },
  quantity: { type: Number, required: true, default: 1 },
  product_price: { type: Number, required: true, min: 0 },
  total_price: { type: Number, required: true, min: 0 },
  order_status: {
    type: String,
    default: 'placed',
    enum: ['placed', 'accepted', 'preparing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'],
  },
  tracking_status: {
    type: String,
    default: 'placed',
    enum: ['placed', 'accepted', 'preparing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'],
  },
  payment_status: { type: String, default: 'cod', enum: ['cod', 'paid', 'failed'] },
  estimated_delivery_date: { type: Date },
  expectedDeliveryTime: { type: Date },
  customerLocation: {
    latitude: { type: Number },
    longitude: { type: Number },
    lat: { type: Number },
    lng: { type: Number },
  },
  artisanLocation: {
    latitude: { type: Number },
    longitude: { type: Number },
    lat: { type: Number },
    lng: { type: Number },
  },
  deliveryDistanceKm: { type: Number },
  distanceKm: { type: Number },
  trackingHistory: [{
    status: { type: String },
    time: { type: Date },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
  }],
  address: {
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
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
}, { _id: false, timestamps: false });

OrderSchema.index({ customer_id: 1 });
OrderSchema.index({ artisan_id: 1 });
OrderSchema.index({ created_at: -1 });

export const Order = mongoose.models.Orders || model<IOrder>('Orders', OrderSchema);
