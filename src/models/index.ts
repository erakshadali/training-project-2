import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface ProductDoc {
  pid: string;
  slug: string;
  name: string;
  category: "furniture" | "appliances";
  subcategory: string;
  art: string;
  tint: string;
  blurb: string;
  description: string;
  rent: number;
  deposit: number;
  features: string[];
  specs: Record<string, string>;
  popular: boolean;
  stock: number;
  active: boolean;
}

export interface UserDoc {
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: "user" | "admin";
}

export interface OrderLineDoc {
  pid: string;
  name: string;
  months: 3 | 6 | 12;
  qty: number;
  rentPerMonth: number;
  deposit: number;
}

export interface OrderDoc {
  orderId: string;
  userId: Types.ObjectId;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  pincode: string;
  deliveryDate: string;
  slot: string;
  payment: string;
  lines: OrderLineDoc[];
  rentPerMonth: number;
  deposit: number;
  status: "Scheduled" | "Delivered" | "Closed" | "Cancelled";
}

const productSchema = new Schema<ProductDoc>(
  {
    pid: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { type: String, enum: ["furniture", "appliances"], required: true, index: true },
    subcategory: { type: String, required: true },
    art: { type: String, required: true },
    tint: { type: String, required: true },
    blurb: { type: String, required: true },
    description: { type: String, required: true },
    rent: { type: Number, required: true, min: 1 },
    deposit: { type: Number, required: true, min: 0 },
    features: { type: [String], default: [] },
    specs: { type: Schema.Types.Mixed, default: {} },
    popular: { type: Boolean, default: false },
    stock: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const userSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
  },
  { timestamps: true },
);

const orderLineSchema = new Schema<OrderLineDoc>(
  {
    pid: { type: String, required: true },
    name: { type: String, required: true },
    months: { type: Number, enum: [3, 6, 12], required: true },
    qty: { type: Number, required: true, min: 1, max: 10 },
    rentPerMonth: { type: Number, required: true },
    deposit: { type: Number, required: true },
  },
  { _id: false },
);

const orderSchema = new Schema<OrderDoc>(
  {
    orderId: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    pincode: { type: String, required: true },
    deliveryDate: { type: String, required: true },
    slot: { type: String, required: true },
    payment: { type: String, required: true },
    lines: { type: [orderLineSchema], required: true },
    rentPerMonth: { type: Number, required: true },
    deposit: { type: Number, required: true },
    status: { type: String, enum: ["Scheduled", "Delivered", "Closed", "Cancelled"], default: "Scheduled" },
  },
  { timestamps: true },
);

function model<T>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

export const ProductModel = model<ProductDoc>("Product", productSchema);
export const UserModel = model<UserDoc>("User", userSchema);
export const OrderModel = model<OrderDoc>("Order", orderSchema);
