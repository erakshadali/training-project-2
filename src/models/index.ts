import mongoose, { Schema, type Model, type Types } from "mongoose";

interface Stamped {
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductDoc extends Stamped {
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

export interface UserDoc extends Stamped {
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: "user" | "admin";
  disabled: boolean;
}

export interface OrderLineDoc {
  pid: string;
  name: string;
  months: 3 | 6 | 12;
  qty: number;
  rentPerMonth: number;
  deposit: number;
}

export interface OrderDoc extends Stamped {
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

export type RentalStatus = "Scheduled" | "Return scheduled" | "Returned" | "Cancelled";

export interface RentalDoc extends Stamped {
  rentalId: string;
  orderId: string;
  userId: Types.ObjectId;
  pid: string;
  name: string;
  qty: number;
  months: number;
  rentPerMonth: number;
  deposit: number;
  startDate: string;
  endDate: string;
  status: RentalStatus;
  extensions: { addedMonths: number; rentPerMonth: number; at: Date }[];
  returnRequest?: { date: string; slot: string; earlyClosureFee: number; requestedAt: Date } | null;
  deliveredAt?: Date | null;
  returnedAt?: Date | null;
}

export type ClaimStatus = "Charged" | "Disputed" | "Upheld" | "Waived";

export interface ClaimDoc extends Stamped {
  claimId: string;
  rentalId: string;
  userId: Types.ObjectId;
  productName: string;
  amount: number;
  note: string;
  status: ClaimStatus;
  disputeMessage: string;
  resolutionNote: string;
  resolvedAt?: Date | null;
}

export interface ServiceAreaDoc {
  name: string;
  active: boolean;
}

export interface MaintenanceDoc extends Stamped {
  requestId: string;
  userId: Types.ObjectId;
  rentalId: string;
  productName: string;
  category: string;
  description: string;
  status: "Open" | "In progress" | "Resolved";
  note: string;
  resolvedAt?: Date | null;
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
    disabled: { type: Boolean, default: false },
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

const rentalSchema = new Schema<RentalDoc>(
  {
    rentalId: { type: String, required: true, unique: true },
    orderId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    pid: { type: String, required: true },
    name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    months: { type: Number, required: true },
    rentPerMonth: { type: Number, required: true },
    deposit: { type: Number, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    status: { type: String, enum: ["Scheduled", "Return scheduled", "Returned", "Cancelled"], default: "Scheduled" },
    extensions: { type: [{ addedMonths: Number, rentPerMonth: Number, at: Date }], default: [] },
    returnRequest: { type: { date: String, slot: String, earlyClosureFee: Number, requestedAt: Date }, default: null },
    deliveredAt: { type: Date, default: null },
    returnedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
rentalSchema.index({ orderId: 1, pid: 1 }, { unique: true });

const maintenanceSchema = new Schema<MaintenanceDoc>(
  {
    requestId: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rentalId: { type: String, required: true, index: true },
    productName: { type: String, required: true },
    category: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: String, enum: ["Open", "In progress", "Resolved"], default: "Open" },
    note: { type: String, default: "" },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const claimSchema = new Schema<ClaimDoc>(
  {
    claimId: { type: String, required: true, unique: true },
    rentalId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    productName: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, required: true },
    status: { type: String, enum: ["Charged", "Disputed", "Upheld", "Waived"], default: "Charged" },
    disputeMessage: { type: String, default: "" },
    resolutionNote: { type: String, default: "" },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const serviceAreaSchema = new Schema<ServiceAreaDoc>({
  name: { type: String, required: true, unique: true, trim: true },
  active: { type: Boolean, default: true },
});

function model<T>(name: string, schema: Schema<T>): Model<T> {
  return (mongoose.models[name] as Model<T> | undefined) ?? mongoose.model<T>(name, schema);
}

export const ProductModel = model<ProductDoc>("Product", productSchema);
export const UserModel = model<UserDoc>("User", userSchema);
export const OrderModel = model<OrderDoc>("Order", orderSchema);
export const RentalModel = model<RentalDoc>("Rental", rentalSchema);
export const MaintenanceModel = model<MaintenanceDoc>("Maintenance", maintenanceSchema);
export const ClaimModel = model<ClaimDoc>("Claim", claimSchema);
export const ServiceAreaModel = model<ServiceAreaDoc>("ServiceArea", serviceAreaSchema);
