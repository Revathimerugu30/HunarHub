import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'hunarhub';

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function calculateDistanceKm(from, to) {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const earthRadiusKm = 6371;
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

const orderSchema = new mongoose.Schema({
  _id: String,
  customer_id: String,
  artisan_id: String,
  address: {
    latitude: Number,
    longitude: Number,
  },
  customerLocation: {
    latitude: Number,
    longitude: Number,
    lat: Number,
    lng: Number,
  },
  artisanLocation: {
    latitude: Number,
    longitude: Number,
    lat: Number,
    lng: Number,
  },
  deliveryDistanceKm: Number,
  distanceKm: Number,
  trackingHistory: Array,
  tracking_status: String,
  order_status: String,
  updated_at: Date,
}, { collection: 'orders', strict: false });

const artisanSchema = new mongoose.Schema({
  artisan_id: String,
  workshop_latitude: Number,
  workshop_longitude: Number,
  workshop_address: String,
}, { collection: 'artisanprofiles', strict: false });

const userSchema = new mongoose.Schema({
  _id: String,
  location: {
    latitude: Number,
    longitude: Number,
  },
  city: String,
}, { collection: 'users', strict: false });

const Order = mongoose.models.Orders || mongoose.model('Orders', orderSchema);
const ArtisanProfile = mongoose.models.ArtisanProfiles || mongoose.model('ArtisanProfiles', artisanSchema);
const User = mongoose.models.Users || mongoose.model('Users', userSchema);

function normalizeLocation(location) {
  if (!location || typeof location !== 'object') return undefined;
  const latitude = typeof location.latitude === 'number' ? location.latitude : typeof location.lat === 'number' ? location.lat : undefined;
  const longitude = typeof location.longitude === 'number' ? location.longitude : typeof location.lng === 'number' ? location.lng : undefined;
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return undefined;
  return { latitude, longitude, lat: latitude, lng: longitude };
}

async function main() {
  await mongoose.connect(`${MONGODB_URI}/${MONGODB_DB}`, { connectTimeoutMS: 10000, serverSelectionTimeoutMS: 10000 });
  console.log('Connected to MongoDB', MONGODB_URI, MONGODB_DB);

  const orders = await Order.find({});
  console.log(`Found ${orders.length} orders`);

  let updated = 0;
  let skipped = 0;

  for (const order of orders) {
    const raw = order.toObject();
    const customerLocation = normalizeLocation(raw.customerLocation ?? raw.address);
    const artisanProfile = await ArtisanProfile.findOne({ artisan_id: raw.artisan_id });
    const artisanUser = await User.findById(raw.artisan_id);
    const artisanLocation = normalizeLocation(raw.artisanLocation)
      ?? normalizeLocation({
        latitude: artisanProfile?.workshop_latitude,
        longitude: artisanProfile?.workshop_longitude,
        lat: artisanProfile?.workshop_latitude,
        lng: artisanProfile?.workshop_longitude,
      })
      ?? normalizeLocation(artisanUser?.location);

    if (!customerLocation || !artisanLocation) {
      skipped += 1;
      console.warn(`Skipping order ${raw._id}: missing customer or artisan location`);
      continue;
    }

    const deliveryDistanceKm = Number(calculateDistanceKm(customerLocation, artisanLocation).toFixed(1));
    const status = raw.tracking_status || raw.order_status || 'placed';
    const trackingHistory = Array.isArray(raw.trackingHistory) && raw.trackingHistory.length
      ? raw.trackingHistory
      : [{ status, time: raw.updated_at ?? new Date(), location: artisanLocation }];

    await Order.updateOne({ _id: raw._id }, {
      $set: {
        customerLocation,
        artisanLocation,
        deliveryDistanceKm,
        distanceKm: deliveryDistanceKm,
        trackingHistory,
      },
    });

    updated += 1;
  }

  console.log(`Updated ${updated} orders, skipped ${skipped} orders.`);
  await mongoose.disconnect();
  console.log('Disconnected');
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
