import { promises as fs } from 'fs';
import path from 'path';
import { connectMongoose, isMongooseConnected } from '@/integrations/mongo/client';
import {
  User, Product, Order, ArtisanProfile, Review, Notification,
  Wishlist, Address, Follower, ServiceRequest
} from '@/integrations/mongo/models';
import {
  verifyToken, extractTokenFromHeader, hashPassword, comparePassword, generateToken
} from '@/integrations/mongo/auth';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

function sanitizeUploadPath(input: string) {
  const normalized = input.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('..')) return null;
  return normalized;
}

function toRadians(degrees: number) {
  return degrees * (Math.PI / 180);
}

function calculateDistanceKm(from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const earthRadiusKm = 6371;
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function safeNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeLocation(location: any) {
  if (!location || typeof location !== 'object') return undefined;
  const latitude = safeNumber(location.latitude ?? location.lat ?? location.latitute ?? location.latidude);
  const longitude = safeNumber(location.longitude ?? location.lng ?? location.long ?? location.lon);
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return undefined;
  return { latitude, longitude, lat: latitude, lng: longitude };
}

function estimateDeliveryTime(distanceKm: number) {
  const days = distanceKm <= 10 ? 2 : distanceKm <= 50 ? 3 : 5;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function buildOrderResponse(order: any, artisanProfile?: any, artisanUser?: any) {
  const obj = { ...order };
  const customerLocation = normalizeLocation(obj.customerLocation ?? obj.address);
  const artisanLocation = normalizeLocation(obj.artisanLocation)
    ?? normalizeLocation({
      latitude: artisanProfile?.workshop_latitude,
      longitude: artisanProfile?.workshop_longitude,
      lat: artisanProfile?.workshop_latitude,
      lng: artisanProfile?.workshop_longitude,
    })
    ?? normalizeLocation(artisanUser?.location);
  obj.customerLocation = customerLocation;
  obj.artisanLocation = artisanLocation;
  obj.deliveryDistanceKm = obj.deliveryDistanceKm ?? obj.distanceKm;
  obj.distanceKm = obj.distanceKm ?? obj.deliveryDistanceKm;
  if (customerLocation && artisanLocation && obj.deliveryDistanceKm == null) {
    obj.deliveryDistanceKm = Number(calculateDistanceKm({ lat: customerLocation.latitude, lng: customerLocation.longitude }, { lat: artisanLocation.latitude, lng: artisanLocation.longitude }).toFixed(1));
    obj.distanceKm = obj.distanceKm ?? obj.deliveryDistanceKm;
  }
  obj.status = obj.tracking_status || obj.order_status;
  obj.orderId = obj._id;
  obj.customerCity = obj.address?.city ?? 'Location updating...';
  obj.artisanLocationCity = artisanProfile?.workshop_address || artisanUser?.city || obj.artisanLocationCity || 'Location updating...';
  obj.trackingTimeline = Array.isArray(obj.trackingHistory) && obj.trackingHistory.length ? obj.trackingHistory : [{ status: obj.status, time: obj.updated_at ?? obj.created_at, location: artisanLocation ?? customerLocation }];
  return obj;
}

// NOTE: The API requires MongoDB to be available. No local mock fallback is used.

// Ensure we only attempt to seed an admin user once per process
let adminSeeded = false;

function jsonResponse(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' }, ...init });
}

function badRequest(message: string) {
  return new Response(JSON.stringify({ error: message }), { status: 400, headers: { 'content-type': 'application/json' } });
}

function unauthorized(message = 'Unauthorized') {
  return new Response(JSON.stringify({ error: message }), { status: 401, headers: { 'content-type': 'application/json' } });
}

function notFound(message = 'Not found') {
  return new Response(JSON.stringify({ error: message }), { status: 404, headers: { 'content-type': 'application/json' } });
}

function extractAuthUserId(request: Request): string | null {
  const header = request.headers.get('authorization');
  const token = extractTokenFromHeader(header);
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded?.userId ?? null;
}

function extractAuthUser(request: Request): { userId: string; role: string } | null {
  const header = request.headers.get('authorization');
  const token = extractTokenFromHeader(header);
  if (!token) return null;
  const decoded = verifyToken(token);
  return decoded ? { userId: decoded.userId, role: decoded.role } : null;
}

export async function handleApiRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const segments = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const method = request.method.toUpperCase();
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin123@gmail.com';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';

  if (segments.length === 0) {
    return jsonResponse({ status: 'ok' });
  }

  // Try to connect Mongoose, but if it fails then fall back to in-memory auth and sample data behavior.
  try {
    await connectMongoose();
    // Seed a default admin user if missing (useful for local dev)
    try {
      if (!adminSeeded && isMongooseConnected()) {
        const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin123@gmail.com';
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';
        let existingAdmin = await User.findOne({ email: ADMIN_EMAIL });
        if (!existingAdmin) {
          const passwordHash = await hashPassword(ADMIN_PASSWORD);
          const newAdmin = new User({
            _id: crypto.randomUUID(),
            email: ADMIN_EMAIL,
            password_hash: passwordHash,
            full_name: 'Admin',
            role: 'admin',
            city: '',
          });
          await newAdmin.save();
          existingAdmin = newAdmin;
          // eslint-disable-next-line no-console
          console.log('Seeded admin user:', ADMIN_EMAIL);
        }
        if (existingAdmin && !(await comparePassword(ADMIN_PASSWORD, existingAdmin.password_hash))) {
          existingAdmin.password_hash = await hashPassword(ADMIN_PASSWORD);
          await existingAdmin.save();
          // eslint-disable-next-line no-console
          console.log('Updated admin password for:', ADMIN_EMAIL);
        }
        adminSeeded = true;
      }
    } catch (seedErr: unknown) {
      // eslint-disable-next-line no-console
      console.warn('Admin seed failed:', seedErr instanceof Error ? seedErr.message : String(seedErr));
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Mongoose not connected, using in-memory fallback');
  }

  const authUser = extractAuthUser(request);
  const authUserId = authUser?.userId ?? null;
  const contentType = request.headers.get('content-type') ?? '';
  const body = method !== 'GET' && method !== 'HEAD' && contentType.includes('application/json')
    ? await request.json().catch(() => null)
    : null;
  const mongooseAvailable = isMongooseConnected();

  const notify = async (params: { userId: string; type: string; title: string; message: string; link?: string }) => {
    if (!mongooseAvailable) return null;
    try {
      const notification = new Notification({
        _id: crypto.randomUUID(),
        user_id: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link,
        read: false,
        created_at: new Date(),
      });
      await notification.save();
      return notification;
    } catch {
      return null;
    }
  };

  const [collection, id, action] = segments;

  switch (collection) {
    case 'auth':
      if (id === 'signup') {
        if (!body?.email || !body?.password || !body?.full_name) return badRequest('Missing signup fields');
        if (body.email.toLowerCase() === (process.env.ADMIN_EMAIL || 'admin123@gmail.com').toLowerCase()) {
          return badRequest('Admin account must be accessed through login. Use the admin login option instead.');
        }
        if (body.role === 'admin') {
          return badRequest('Admin signup is not permitted. Please sign in as an admin using the login form.');
        }
        try {
          if (!mongooseAvailable) return badRequest('Database unavailable');
          const existing = await User.findOne({ email: body.email });
          if (existing) return badRequest('Email already registered');
          const passwordHash = await hashPassword(body.password);
          const newUser = new User({
            _id: body.id || crypto.randomUUID(),
            email: body.email,
            password_hash: passwordHash,
            full_name: body.full_name,
            role: body.role || 'customer',
            city: body.city,
            location: body.location ?? undefined,
            blocked: false,
          });
          await newUser.save();
          if (newUser.role === 'artisan' && mongooseAvailable) {
            try {
              const admins = await User.find({ role: 'admin' });
              await Promise.all(admins.map((admin) => notify({
                userId: admin._id,
                type: 'new_artisan',
                title: 'New artisan joined',
                message: `${newUser.full_name} joined as an artisan.`,
                link: '/admin-dashboard#artisans',
              })));
            } catch {
              // ignore notification failures
            }
          }
          const token = generateToken(newUser._id, newUser.role);
          return jsonResponse({ token, user: newUser }, { status: 201 });
        } catch (err: any) {
          return badRequest(err?.message ?? 'Signup failed');
        }
      }
      if (id === 'login') {
        if (!body?.email || !body?.password) return badRequest('Missing email or password');
        try {
          if (!mongooseAvailable) {
            if (body.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && body.password === ADMIN_PASSWORD) {
              const fakeAdmin = {
                _id: 'admin',
                email: ADMIN_EMAIL,
                role: 'admin',
                full_name: 'Admin',
                city: '',
              };
              return jsonResponse({ token: generateToken(fakeAdmin._id, fakeAdmin.role), user: fakeAdmin });
            }
            return badRequest('Database unavailable');
          }
          const user = await User.findOne({ email: body.email });
          if (!user) return unauthorized('Invalid credentials');
          if (user.blocked) return unauthorized('Your account has been blocked. Contact support.');
          const isValid = await comparePassword(body.password, user.password_hash);
          if (!isValid) return unauthorized('Invalid credentials');
          const token = generateToken(user._id, user.role);
          return jsonResponse({ token, user });
        } catch (err: any) {
          return unauthorized(err?.message ?? 'Login failed');
        }
      }
      if (id === 'me' && method === 'GET') {
        if (!authUserId) return unauthorized();
          try {
            if (!mongooseAvailable) return badRequest('Database unavailable');
            const user = await User.findById(authUserId);
            return user ? jsonResponse(user) : unauthorized();
          } catch (err) {
            return unauthorized();
          }
      }
      break;

    case 'users':
      if (method === 'GET' && !id && url.searchParams.has('all')) {
        if (!authUser || authUser.role !== 'admin') return unauthorized();
        const users = await User.find().sort({ created_at: -1 });
        return jsonResponse(users.map((u: any) => u.toObject()));
      }
      if (method === 'GET' && id) {
        try {
          const user = await User.findById(id);
          return user ? jsonResponse(user) : notFound();
        } catch (err) {
          return notFound();
        }
      }
      if (method === 'DELETE' && id) {
        if (!authUser || authUser.role !== 'admin') return unauthorized();
        try {
          await User.deleteOne({ _id: id });
          return new Response(null, { status: 204 });
        } catch (err: any) {
          return badRequest(err?.message ?? 'User delete failed');
        }
      }
      if (method === 'POST') {
        if (!body?.id || !body?.email || !body?.role) return badRequest('Missing user fields');
        try {
          const passwordHash = body.password ? await hashPassword(body.password) : '';
          const userDoc = new User({
            _id: body.id,
            email: body.email,
            password_hash: passwordHash,
            full_name: body.full_name || '',
            role: body.role,
            city: body.city,
          });
          await userDoc.save();
          return jsonResponse({ success: true, user: userDoc }, { status: 201 });
        } catch (err: any) {
          return badRequest(err?.message ?? 'User creation failed');
        }
      }
      if (method === 'PUT' && id) {
        if (!authUserId) return unauthorized();
        if (authUser?.role !== 'admin' && authUserId !== id) return unauthorized();
        try {
          const updated = await User.findByIdAndUpdate(id, body, { new: true });
          return jsonResponse(updated);
        } catch (err: any) {
          return badRequest(err?.message ?? 'User update failed');
        }
      }
      break;

    case 'artisans':
      if (!id && method === 'GET' && url.searchParams.has('nearby')) {
        const lat = Number(url.searchParams.get('lat'));
        const lng = Number(url.searchParams.get('lng'));
        const radius = Number(url.searchParams.get('radius') ?? 50);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return badRequest('Missing latitude or longitude');
        const artisans = await ArtisanProfile.find({ workshop_latitude: { $ne: null }, workshop_longitude: { $ne: null } });
        const nearby = artisans
          .map((artisan: any) => {
            const aLat = Number(artisan.workshop_latitude);
            const aLng = Number(artisan.workshop_longitude);
            if (Number.isNaN(aLat) || Number.isNaN(aLng)) return null;
            const toRad = (deg: number) => deg * (Math.PI / 180);
            const dLat = toRad(aLat - lat);
            const dLng = toRad(aLng - lng);
            const earthRadius = 6371;
            const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(aLat)) * Math.sin(dLng / 2) ** 2;
            const distanceKm = earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
            return {
              ...artisan.toObject(),
              distanceKm: Number(distanceKm.toFixed(1)),
            };
          })
          .filter(Boolean)
          .filter((artisan: any) => artisan.distanceKm <= radius)
          .sort((a: any, b: any) => a.distanceKm - b.distanceKm);
        return jsonResponse(nearby);
      }
      if (!id && method === 'GET' && url.searchParams.has('all')) {
        if (!authUser || authUser.role !== 'admin') return unauthorized();
        const artisans = await ArtisanProfile.find().sort({ updated_at: -1 });
        return jsonResponse(artisans.map((a: any) => a.toObject()));
      }
      if (id === 'profile' || action === 'profile') {
        const artisanId = id === 'profile' ? action : id;
        if (method === 'GET') {
          try {
            const profile = await ArtisanProfile.findOne({ artisan_id: artisanId });
            return jsonResponse(profile ?? {});
          } catch (err) {
            return jsonResponse({});
          }
        }
        if (method === 'PUT') {
          // Allow artisans to update their own profile, or admins to update any profile (including verification)
          if (!authUserId || (authUserId !== artisanId && authUser?.role !== 'admin')) return unauthorized();
          try {
            const profileData: any = {
              artisan_id: artisanId,
              updated_at: new Date(),
              bio: body?.bio,
              skills: body?.skills,
              experience_years: body?.experience_years,
              available: body?.available,
              avatar_url: body?.avatar_url,
              workshop_name: body?.workshop_name,
              workshop_address: body?.workshop_address,
              workshop_latitude: body?.workshop_latitude,
              workshop_longitude: body?.workshop_longitude,
            };
            // Only allow admins to set the verified flag
            if (typeof body?.verified !== 'undefined' && authUser?.role === 'admin') {
              profileData.verified = !!body.verified;
            }
            const updated = await ArtisanProfile.findOneAndUpdate(
              { artisan_id: artisanId },
              { $set: profileData },
              { upsert: true, new: true }
            );
            return jsonResponse(updated);
          } catch (err: any) {
            return badRequest(err?.message ?? 'Profile update failed');
          }
        }
      }
      break;

    case 'products':
      if (method === 'GET' && !id) {
        try {
          if (!mongooseAvailable) return badRequest('Database unavailable');
          const filter: any = {};
          const hasArtisanId = url.searchParams.has('artisanId');
          const artisanId = url.searchParams.get('artisanId')?.trim() ?? '';
          if (hasArtisanId) filter.artisan_id = artisanId;
          const products = await Product.find(filter).sort({ created_at: -1 });
          const normalized = products.map((p: any) => ({ ...p.toObject(), id: p._id }));
          return jsonResponse(normalized);
        } catch (err) {
          return jsonResponse([]);
        }
      }
      if (method === 'GET' && id) {
        try {
          if (!mongooseAvailable) return badRequest('Database unavailable');
          const product = await Product.findById(id);
          if (!product) return notFound();
          const artisanProfile = await ArtisanProfile.findOne({ artisan_id: product.artisan_id });
          const artisanUser = await User.findById(product.artisan_id);
          const artisanLocation = normalizeLocation({
            latitude: artisanProfile?.workshop_latitude,
            longitude: artisanProfile?.workshop_longitude,
            lat: artisanProfile?.workshop_latitude,
            lng: artisanProfile?.workshop_longitude,
          }) ?? normalizeLocation(artisanUser?.location);
          return jsonResponse({
            ...product.toObject(),
            id: product._id,
            artisanLocationAvailable: Boolean(artisanLocation),
          });
        } catch (err) {
          return notFound();
        }
      }
      if (method === 'POST') {
        if (!authUserId) return unauthorized();
        if (!mongooseAvailable) return badRequest('Database unavailable');
        try {
          const newProduct = new Product({
            _id: body?.id ?? crypto.randomUUID(),
            title: body?.title ?? '',
            description: body?.description ?? '',
            price: Number(body?.price ?? 0),
            stock: Number(body?.stock ?? 0),
            category: body?.category ?? 'artisan',
            images: body?.images ?? [],
            colors: body?.colors ?? [],
            sizes: body?.sizes ?? [],
            artisan_id: authUserId,
            created_at: new Date(),
            updated_at: new Date(),
          });
          await newProduct.save();
          return jsonResponse(newProduct, { status: 201 });
        } catch (err: any) {
          return badRequest(err?.message ?? 'Product creation failed');
        }
      }
      if (method === 'DELETE' && id) {
        if (!authUserId) return unauthorized();
        if (!mongooseAvailable) return badRequest('Database unavailable');
        try {
          const product = await Product.findById(id);
          if (!product) return notFound();
          if (product.artisan_id !== authUserId && authUser?.role !== 'admin') return unauthorized();
          await Product.deleteOne({ _id: id });
          return new Response(null, { status: 204 });
        } catch (err) {
          return notFound();
        }
      }
      if (method === 'PUT' && id) {
        if (!authUserId) return unauthorized();
        if (!mongooseAvailable) return badRequest('Database unavailable');
        try {
          const product = await Product.findById(id);
          if (!product) return notFound();
          if (product.artisan_id !== authUserId) return unauthorized();
          const updated = await Product.findByIdAndUpdate(id, {
            ...body,
            updated_at: new Date(),
          }, { new: true });

          if (updated && mongooseAvailable) {
            try {
              const followers = await Follower.find({ artisan_id: product.artisan_id });
              const wishlisters = await Wishlist.find({ product_id: id });
              const recipientIds = new Set<string>([
                ...followers.map((f: any) => f.follower_id),
                ...wishlisters.map((w: any) => w.user_id),
              ]);
              const title = `Product updated: ${updated.title ?? product.title}`;
              const message = `The artisan has updated ${updated.title ?? product.title}. Check the latest details.`;
              const link = `/product/${id}`;
              await Promise.all(Array.from(recipientIds).map((userId) => notify({ userId, type: 'product_update', title, message, link })));
            } catch {
              // ignore notification failures
            }
          }

          return jsonResponse(updated);
        } catch (err: any) {
          return badRequest(err?.message ?? 'Product update failed');
        }
      }
      break;

    case 'storage':
      if ((id === 'upload' || action === 'upload') && method === 'POST') {
        try {
          const form = await request.formData();
          const file = form.get('file');
          const pathValue = form.get('path');
          if (!file || !pathValue) return badRequest('Missing file or path');

          const uploadPath = sanitizeUploadPath(String(pathValue));
          if (!uploadPath) return badRequest('Invalid upload path');

          const destination = path.join(UPLOADS_DIR, uploadPath);
          await fs.mkdir(path.dirname(destination), { recursive: true });
          const buffer = Buffer.from(await (file as any).arrayBuffer());
          await fs.writeFile(destination, buffer);

          const urlPath = `/uploads/${uploadPath.replace(/\\/g, '/')}`;
          return jsonResponse({ signedUrl: urlPath });
        } catch (err: any) {
          return badRequest(err?.message ?? 'Storage upload failed');
        }
      }
      break;

    case 'orders':
      if (method === 'GET' && id) {
        try {
          const order = await Order.findById(id);
          if (!order) return notFound();
          const isAuthorized = authUser && (authUser.role === 'admin' || authUserId === order.customer_id || authUserId === order.artisan_id);
          if (!isAuthorized) return unauthorized();
          const artisanProfile = await ArtisanProfile.findOne({ artisan_id: order.artisan_id });
          const artisanUser = await User.findById(order.artisan_id);
          return jsonResponse(buildOrderResponse(order.toObject(), artisanProfile, artisanUser));
        } catch (err) {
          return notFound();
        }
      }
      if (method === 'GET') {
        try {
          const filter: any = {};
          if (url.searchParams.has('customerId')) filter.customer_id = url.searchParams.get('customerId');
          if (url.searchParams.has('artisanId')) filter.artisan_id = url.searchParams.get('artisanId');
          if (url.searchParams.has('all')) {
            if (!authUser || authUser.role !== 'admin') return unauthorized();
          }
          const orders = await Order.find(filter).sort({ created_at: -1 });
          const artisanIds = Array.from(new Set(orders.map((order: any) => order.artisan_id)));
          const artisanProfiles = await ArtisanProfile.find({ artisan_id: { $in: artisanIds } });
          const artisanUsers = await User.find({ _id: { $in: artisanIds } });
          const artisanProfileById = new Map(artisanProfiles.map((profile: any) => [profile.artisan_id, profile]));
          const artisanUserById = new Map(artisanUsers.map((user: any) => [user._id, user]));
          const raw = orders.map((order: any) => {
            const artisanProfile = artisanProfileById.get(order.artisan_id);
            const artisanUser = artisanUserById.get(order.artisan_id);
            return buildOrderResponse(order.toObject(), artisanProfile, artisanUser);
          });
          return jsonResponse(raw);
        } catch (err) {
          return jsonResponse([]);
        }
      }
      if (method === 'POST') {
        if (!authUser || authUser.role !== 'customer') return unauthorized();
        if (!authUserId) return unauthorized();
        try {
          const product = await Product.findById(body?.product_id);
          if (!product) return badRequest('Product not found');
          if (!body?.full_name || !body?.mobile || !body?.house || !body?.street || !body?.city || !body?.state || !body?.pincode) {
            return badRequest('Missing shipping address fields');
          }

          const selectedAddress = body?.addressId ? await Address.findById(body.addressId) : null;
          const customerLat = safeNumber(selectedAddress?.latitude ?? body.customerLatitude ?? body.latitude ?? body.address_latitude);
          const customerLng = safeNumber(selectedAddress?.longitude ?? body.customerLongitude ?? body.longitude ?? body.address_longitude);
          const customerLocation = customerLat != null && customerLng != null
            ? { latitude: customerLat, longitude: customerLng, lat: customerLat, lng: customerLng }
            : undefined;

          const artisanProfile = await ArtisanProfile.findOne({ artisan_id: product.artisan_id });
          const artisanUser = await User.findById(product.artisan_id);
          const artisanLat = safeNumber(artisanProfile?.workshop_latitude ?? artisanUser?.location?.latitude);
          const artisanLng = safeNumber(artisanProfile?.workshop_longitude ?? artisanUser?.location?.longitude);
          const artisanLocation = artisanLat != null && artisanLng != null
            ? { latitude: artisanLat, longitude: artisanLng, lat: artisanLat, lng: artisanLng }
            : undefined;

          if (!customerLocation) {
            return badRequest('Customer location required for delivery tracking');
          }

          const deliveryDistanceKm = artisanLocation
            ? Number(calculateDistanceKm({ lat: customerLocation.latitude, lng: customerLocation.longitude }, { lat: artisanLocation.latitude, lng: artisanLocation.longitude }).toFixed(1))
            : undefined;
          const expectedDeliveryTime = body.expectedDeliveryTime
            ? new Date(body.expectedDeliveryTime)
            : estimateDeliveryTime(deliveryDistanceKm);

          const addressData = selectedAddress ? selectedAddress : {
            full_name: body.full_name,
            mobile: body.mobile,
            house: body.house,
            area: body.street,
            city: body.city,
            state: body.state,
            pincode: body.pincode,
            landmark: body.landmark ?? '',
            latitude: customerLat,
            longitude: customerLng,
          };

          const newOrder = new Order({
            _id: crypto.randomUUID(),
            customer_id: authUserId,
            artisan_id: product.artisan_id,
            product_id: body.product_id,
            addressId: body.addressId ?? selectedAddress?._id,
            quantity: Number(body.quantity ?? 1),
            product_price: Number(body.product_price ?? 0),
            total_price: Number(body.total_price ?? 0),
            order_status: body.order_status ?? 'placed',
            tracking_status: body.tracking_status ?? (body.order_status ?? 'placed'),
            payment_status: body.payment_status ?? 'cod',
            estimated_delivery_date: body.estimated_delivery_date ? new Date(body.estimated_delivery_date) : undefined,
            expectedDeliveryTime,
            customerLocation,
            artisanLocation,
            deliveryDistanceKm,
            distanceKm: deliveryDistanceKm,
            trackingHistory: [{
              status: body.tracking_status ?? (body.order_status ?? 'placed'),
              time: new Date(),
              location: artisanLocation ?? customerLocation,
            }],
            address: {
              full_name: addressData.full_name ?? '',
              mobile: addressData.mobile ?? '',
              house: addressData.house ?? '',
              area: addressData.area ?? '',
              city: addressData.city ?? '',
              state: addressData.state ?? '',
              pincode: addressData.pincode ?? '',
              landmark: addressData.landmark ?? '',
              latitude: addressData.latitude ?? customerLocation?.latitude ?? undefined,
              longitude: addressData.longitude ?? customerLocation?.longitude ?? undefined,
            },
            created_at: new Date(),
            updated_at: new Date(),
          });
          await newOrder.save();

          if (mongooseAvailable) {
            if (body.is_default) {
              await Address.updateMany({ user_id: authUserId }, { is_default: false });
            }
            await Address.findOneAndUpdate(
              {
                user_id: authUserId,
                full_name: body.full_name,
                mobile: body.mobile,
                house: body.house,
                area: body.street,
                city: body.city,
                state: body.state,
                pincode: body.pincode,
                landmark: body.landmark ?? '',
              },
              {
                $set: {
                  user_id: authUserId,
                  full_name: body.full_name,
                  mobile: body.mobile,
                  house: body.house,
                  area: body.street,
                  city: body.city,
                  state: body.state,
                  pincode: body.pincode,
                  landmark: body.landmark ?? '',
                  latitude: customerLat,
                  longitude: customerLng,
                  is_default: body.is_default ?? false,
                },
                $setOnInsert: {
                  _id: crypto.randomUUID(),
                  created_at: new Date(),
                },
              },
              { upsert: true, new: true }
            );
          }

          await notify({
            userId: authUserId,
            type: 'order_placed',
            title: 'Order placed',
            message: `Your order for ${product.title} is placed successfully.`,
            link: '/customer-orders',
          });
          await notify({
            userId: product.artisan_id,
            type: 'new_order',
            title: 'New order received',
            message: `A customer placed a new order for ${product.title}.`,
            link: '/artisan-orders',
          });
          return jsonResponse(newOrder, { status: 201 });
        } catch (err: any) {
          return badRequest(err?.message ?? 'Order creation failed');
        }
      }
      if (method === 'PUT' && id) {
        if (!authUser) return unauthorized();
        try {
          const order = await Order.findById(id);
          if (!order) return notFound();
          if (order.artisan_id !== authUserId) return unauthorized();

          const updatedFields: any = {
            ...body,
            updated_at: new Date(),
          };
          if (body.order_status || body.tracking_status) {
            updatedFields.tracking_status = body.tracking_status ?? body.order_status ?? order.tracking_status;
          }
          if (body.estimated_delivery_date) {
            updatedFields.estimated_delivery_date = new Date(body.estimated_delivery_date);
          }

          const distanceToUse = order.deliveryDistanceKm ?? order.distanceKm;
          if (distanceToUse != null) {
            updatedFields.expectedDeliveryTime = estimateDeliveryTime(distanceToUse);
          }

          const newStatus = updatedFields.tracking_status ?? order.tracking_status;
          const historyEntry = {
            status: newStatus,
            time: new Date(),
            location: order.artisanLocation ?? order.customerLocation,
          };
          updatedFields.trackingHistory = Array.isArray(order.trackingHistory) ? [...order.trackingHistory, historyEntry] : [historyEntry];

          const updated = await Order.findByIdAndUpdate(id, updatedFields, { new: true });
          if (updated && updated.tracking_status !== order.tracking_status) {
            await notify({
              userId: updated.customer_id,
              type: 'order_update',
              title: 'Order status updated',
              message: `Your order is now ${updated.tracking_status.replace(/_/g, ' ')}.`,
              link: '/customer-orders',
            });
          }

          return jsonResponse(updated);
        } catch (err: any) {
          return badRequest(err?.message ?? 'Order update failed');
        }
      }
      break;
    case 'addresses':
      if (!authUser) return unauthorized();
      if (method === 'GET') {
        try {
          const addresses = await Address.find({ user_id: authUserId }).sort({ created_at: -1 });
          return jsonResponse(addresses.map((a: any) => a.toObject()));
        } catch (err) {
          return jsonResponse([]);
        }
      }
      if (method === 'POST') {
        if (!body?.full_name || !body?.mobile || !body?.house || !body?.street || !body?.city || !body?.state || !body?.pincode) {
          return badRequest('Missing shipping address fields');
        }
        try {
          if (body.is_default) {
            await Address.updateMany({ user_id: authUserId }, { is_default: false });
          }
          const newAddress = new Address({
            _id: crypto.randomUUID(),
            user_id: authUserId,
            full_name: body.full_name,
            mobile: body.mobile,
            house: body.house,
            area: body.street,
            city: body.city,
            state: body.state,
            pincode: body.pincode,
            landmark: body.landmark ?? '',
            latitude: body.latitude ?? body.address_latitude ?? undefined,
            longitude: body.longitude ?? body.address_longitude ?? undefined,
            is_default: body.is_default ?? false,
            created_at: new Date(),
          });
          await newAddress.save();
          return jsonResponse(newAddress, { status: 201 });
        } catch (err: any) {
          return badRequest(err?.message ?? 'Address save failed');
        }
      }
      break;
    

    case 'wishlists':
    case 'wishlist':
      if (method === 'GET') {
        if (!url.searchParams.has('userId')) return badRequest('Missing userId');
        try {
          const userId = url.searchParams.get('userId');
          const items = await Wishlist.find({ user_id: userId });
          return jsonResponse(items.map((w: any) => w.toObject()));
        } catch (err) {
          return jsonResponse([]);
        }
      }
      if (method === 'POST') {
        if (!authUserId) return unauthorized();
        try {
          const existing = await Wishlist.findOne({ user_id: authUserId, product_id: body.product_id });
          if (!existing) {
            const newWishlist = new Wishlist({
              _id: crypto.randomUUID(),
              user_id: authUserId,
              product_id: body.product_id,
              created_at: new Date(),
            });
            await newWishlist.save();
          }
          return jsonResponse({ success: true });
        } catch (err: any) {
          return badRequest(err?.message ?? 'Wishlist add failed');
        }
      }
      if (method === 'DELETE') {
        if (!authUserId) return unauthorized();
        try {
          await Wishlist.deleteOne({ user_id: authUserId, product_id: url.searchParams.get('productId') });
          return new Response(null, { status: 204 });
        } catch (err) {
          return new Response(null, { status: 204 });
        }
      }
      break;

    case 'reviews':
      if (method === 'GET') {
        try {
          const filter: any = {};
          if (url.searchParams.has('artisanId')) filter.artisan_id = url.searchParams.get('artisanId');
          const reviews = await Review.find(filter).sort({ created_at: -1 });
          return jsonResponse(reviews.map((r: any) => r.toObject()));
        } catch (err) {
          return jsonResponse([]);
        }
      }
      if (method === 'POST') {
        if (!authUserId) return unauthorized();
        try {
          const newReview = new Review({
            _id: crypto.randomUUID(),
            artisan_id: body.artisan_id,
            customer_id: authUserId,
            rating: Number(body.rating ?? 0),
            comment: body.comment ?? '',
            created_at: new Date(),
          });
          await newReview.save();
          if (mongooseAvailable && body.artisan_id) {
            await notify({
              userId: body.artisan_id,
              type: 'new_review',
              title: 'New review received',
              message: `You received a new review from a customer.`,
              link: `/product/${String(body.product_id ?? '')}`,
            });
          }
          return jsonResponse(newReview, { status: 201 });
        } catch (err: any) {
          return badRequest(err?.message ?? 'Review creation failed');
        }
      }
      break;

    case 'notifications':
      if (method === 'GET') {
        if (!url.searchParams.has('userId')) return badRequest('Missing userId');
        const userId = url.searchParams.get('userId');
        if (!authUserId || authUserId !== userId) return unauthorized();
        try {
          const notifications = await Notification.find({ user_id: userId }).sort({ created_at: -1 });
          return jsonResponse(notifications.map((n: any) => n.toObject()));
        } catch (err) {
          return jsonResponse([]);
        }
      }
      if (method === 'PUT' && !id) {
        if (!url.searchParams.has('userId')) return badRequest('Missing userId');
        const userId = url.searchParams.get('userId');
        if (!authUserId || authUserId !== userId) return unauthorized();
        try {
          await Notification.updateMany({ user_id: userId, read: false }, { read: true });
          return jsonResponse({ success: true });
        } catch (err) {
          return badRequest('Unable to mark notifications read');
        }
      }
      if (method === 'PUT' && id) {
        if (!authUserId) return unauthorized();
        try {
          const notification = await Notification.findById(id);
          if (!notification || notification.user_id !== authUserId) return unauthorized();
          notification.read = true;
          await notification.save();
          return jsonResponse(notification.toObject());
        } catch (err) {
          return badRequest('Unable to update notification');
        }
      }
      if (method === 'POST') {
        if (!body?.user_id) return badRequest('Missing user_id');
        try {
          const newNotification = new Notification({
            _id: crypto.randomUUID(),
            user_id: body.user_id,
            type: body.type ?? 'info',
            message: body.message ?? '',
            read: false,
            created_at: new Date(),
          });
          await newNotification.save();
          return jsonResponse({ success: true }, { status: 201 });
        } catch (err: any) {
          return badRequest(err?.message ?? 'Notification creation failed');
        }
      }
      if (method === 'PUT') {
        if (!authUserId) return unauthorized();
        if (id) {
          try {
            const notification = await Notification.findById(id);
            if (!notification || notification.user_id !== authUserId) return unauthorized();
            const updated = await Notification.findByIdAndUpdate(id, { ...body }, { new: true });
            return jsonResponse(updated);
          } catch (err: any) {
            return badRequest(err?.message ?? 'Notification update failed');
          }
        }
        if (url.searchParams.has('userId')) {
          const userId = url.searchParams.get('userId');
          if (userId !== authUserId) return unauthorized();
          try {
            await Notification.updateMany({ user_id: userId, read: false }, { read: true });
            return jsonResponse({ success: true });
          } catch (err: any) {
            return badRequest(err?.message ?? 'Notification update failed');
          }
        }
      }
      break;

    case 'follows':
      if (method === 'GET') {
        try {
          const filter: any = {};
          if (url.searchParams.has('followerId')) filter.follower_id = url.searchParams.get('followerId');
          if (url.searchParams.has('artisanId')) filter.artisan_id = url.searchParams.get('artisanId');
          const items = await Follower.find(filter);
          return jsonResponse(items.map((i: any) => i.toObject()));
        } catch (err) {
          return jsonResponse([]);
        }
      }
      if (method === 'POST') {
        if (!authUserId) return unauthorized();
        try {
          const updated = await Follower.findOneAndUpdate(
            { follower_id: authUserId, artisan_id: body.artisan_id },
            { follower_id: authUserId, artisan_id: body.artisan_id, created_at: new Date() },
            { upsert: true, new: true }
          );
          return jsonResponse({ success: true });
        } catch (err: any) {
          return badRequest(err?.message ?? 'Follow action failed');
        }
      }
      if (method === 'DELETE') {
        if (!authUserId) return unauthorized();
        try {
          await Follower.deleteOne({ follower_id: authUserId, artisan_id: url.searchParams.get('artisanId') });
          return new Response(null, { status: 204 });
        } catch (err) {
          return new Response(null, { status: 204 });
        }
      }
      break;

    case 'service-requests':
      if (method === 'GET') {
        try {
          const filter: any = {};
          if (url.searchParams.has('customerId')) filter.customer_id = url.searchParams.get('customerId');
          if (url.searchParams.has('status')) filter.status = url.searchParams.get('status');
          const requests = await ServiceRequest.find(filter).sort({ created_at: -1 });
          return jsonResponse(requests.map((r: any) => r.toObject()));
        } catch (err) {
          return jsonResponse([]);
        }
      }
      if (method === 'POST') {
        if (!authUserId) return unauthorized();
        try {
          const newRequest = new ServiceRequest({
            _id: crypto.randomUUID(),
            customer_id: authUserId,
            description: body.description ?? '',
            status: 'open',
            created_at: new Date(),
            updated_at: new Date(),
          });
          await newRequest.save();
          return jsonResponse(newRequest, { status: 201 });
        } catch (err: any) {
          return badRequest(err?.message ?? 'Service request creation failed');
        }
      }
      break;
  }

  return new Response(JSON.stringify({ error: 'Unsupported API route' }), { status: 404, headers: { 'content-type': 'application/json' } });
}

