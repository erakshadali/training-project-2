import { json } from "@/lib/auth";
import { requireAdmin } from "@/lib/adminGuard";
import { serializeRequest } from "@/lib/rentalsServer";
import { MaintenanceModel, UserModel } from "@/models";

export async function GET() {
  const g = await requireAdmin();
  if ("error" in g) return g.error;
  const list = await MaintenanceModel.find({}).sort({ createdAt: -1 }).lean();
  const users = await UserModel.find({ _id: { $in: [...new Set(list.map((m) => String(m.userId)))] } }, { name: 1, phone: 1 }).lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return json({
    requests: list.map((m) => ({ ...serializeRequest(m as never), customer: byId.get(String(m.userId))?.name ?? "", phone: byId.get(String(m.userId))?.phone ?? "" })),
  });
}
