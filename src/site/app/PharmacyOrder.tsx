/**
 * Demo pharmacy ordering, shown on the patient Medicines page: the SQLite medicines catalogue
 * (GET /api/medicines), a cart, a delivery address, an attached City Healer prescription for
 * prescription-only items (GET /api/v1/prescriptions/mine), POST /api/medicines/order and
 * "My orders" (GET /api/medicines/orders).
 *
 * The server recomputes the total from the catalogue, checks stock and refuses Rx items with no
 * prescription attached. It records the attachment as prescriptionAttached + prescriptionName (a
 * label, not a verified reference), so the screen only offers the patient's own prescriptions.
 * No payment is taken and nothing is delivered.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import { useI18n } from "../i18n";
import { useSession } from "../lib/session";
import { request } from "../lib/api";
import { Badge, Button, Card, ErrorNote, Spinner } from "../components/ui";

type Medicine = { id: string; name: string; category: string; price: number; stock: number; description?: string; requiresPrescription: boolean; dosageForm?: string };
type Rx = { id: string; doctorName?: string; diagnosis: string; issuedAt?: string };
type Order = { id: string; items: Array<{ name: string; quantity: number; price: number }>; totalAmount: number; status: string; prescriptionAttached: boolean; prescriptionName?: string; deliveryAddress?: string; createdAt: string };

const rupees = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const rxLabel = (r: Rx) => `${(r.issuedAt || "").slice(0, 10)} · ${r.doctorName || ""} · ${r.diagnosis}`;

export default function PharmacyOrder() {
  const { t, locale } = useI18n();
  const ph = t.pharmacy;
  const { user } = useSession();

  const [catalogue, setCatalogue] = useState<Medicine[] | null>(null);
  const [catError, setCatError] = useState("");
  const [filter, setFilter] = useState("");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [address, setAddress] = useState("");
  const [rxList, setRxList] = useState<Rx[] | null>(null);
  const [rxError, setRxError] = useState("");
  const [rxId, setRxId] = useState("");
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState("");
  const [placed, setPlaced] = useState("");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [ordersError, setOrdersError] = useState("");

  const loadCatalogue = () => {
    setCatError(""); setCatalogue(null);
    request<Medicine[]>("/api/medicines").then(setCatalogue).catch((e) => setCatError(e.message || ph.loadError));
  };
  const loadOrders = () => {
    if (!user) return;
    setOrdersError(""); setOrders(null);
    request<Order[]>("/api/medicines/orders")
      .then((list) => setOrders(list.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))))
      .catch((e) => setOrdersError(e.message || ph.ordersError));
  };
  const loadRx = () => {
    if (!user) return;
    setRxError("");
    request<{ prescriptions: Rx[] }>("/api/v1/prescriptions/mine")
      .then((r) => setRxList(r.prescriptions || []))
      .catch((e) => { setRxList([]); setRxError(e.message || ph.rxLoadError); });
  };
  useEffect(loadCatalogue, []);
  useEffect(() => { loadOrders(); loadRx(); }, [user?.uid]);

  const byId = useMemo(() => new Map((catalogue || []).map((m) => [m.id, m])), [catalogue]);
  const lines = Object.entries(cart).map(([id, qty]) => ({ med: byId.get(id), qty })).filter((l): l is { med: Medicine; qty: number } => !!l.med);
  const total = lines.reduce((s, l) => s + l.med.price * l.qty, 0);
  const rxNames = lines.filter((l) => l.med.requiresPrescription).map((l) => l.med.name);
  const chosenRx = rxList?.find((r) => r.id === rxId);
  const shown = (catalogue || []).filter((m) => {
    const q = filter.trim().toLowerCase();
    return !q || m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q);
  });

  const setQty = (m: Medicine, qty: number) => setCart((c) => {
    const next = { ...c };
    const q = Math.max(0, Math.min(qty, m.stock, 100));
    if (q === 0) delete next[m.id]; else next[m.id] = q;
    return next;
  });

  const canPlace = !!user && lines.length > 0 && address.trim().length >= 5 && (rxNames.length === 0 || !!chosenRx) && !placing;
  const place = async () => {
    setPlacing(true); setPlaceError(""); setPlaced("");
    try {
      const res = await request<{ order: Order }>("/api/medicines/order", {
        body: {
          items: lines.map((l) => ({ medicineId: l.med.id, quantity: l.qty })),
          deliveryAddress: address.trim().slice(0, 300),
          ...(rxNames.length && chosenRx ? { prescriptionAttached: true, prescriptionName: `City Healer prescription ${chosenRx.id}: ${rxLabel(chosenRx)}`.slice(0, 200) } : {}),
        },
      });
      setPlaced(res.order.id);
      setCart({}); setRxId("");
      loadOrders(); loadCatalogue();
    } catch (e: any) {
      setPlaceError(e.message || ph.placeError);
    } finally { setPlacing(false); }
  };

  const input = "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] outline-none focus:border-care focus:ring-4 focus:ring-care/15";
  const qtyBtn = "grid h-8 w-8 place-items-center rounded-lg border border-line hover:border-care disabled:opacity-40";

  return (
    <section className="space-y-4" aria-labelledby="pharmacy-title">
      <div>
        <h2 id="pharmacy-title" className="font-display text-[24px]">{ph.title}</h2>
        <p role="note" className="mt-2 rounded-xl border border-warn/40 bg-warn/10 px-3.5 py-2.5 text-sm">{ph.demoNote}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card className="p-5">
          <p className="font-semibold">{ph.catalogue}</p>
          <label htmlFor="ph-filter" className="sr-only">{ph.filter}</label>
          <input id="ph-filter" className={`${input} mt-3`} placeholder={ph.filter} value={filter} onChange={(e) => setFilter(e.target.value)} />
          {catError ? <div className="mt-3"><ErrorNote message={`${ph.loadError} (${catError})`} onRetry={loadCatalogue} /></div>
            : !catalogue ? <div className="mt-3"><Spinner label={ph.loading} /></div>
            : shown.length === 0 ? <p className="mt-3 text-subtle">{ph.empty}</p>
            : (
              <ul className="mt-3 max-h-[460px] divide-y divide-line overflow-y-auto pr-1">
                {shown.map((m) => (
                  <li key={m.id} className="flex items-start gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{m.name}</p>
                      <p className="text-sm text-subtle">{m.category}{m.dosageForm ? ` · ${m.dosageForm}` : ""} · {rupees(m.price)}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {m.requiresPrescription && <Badge tone="warn">{ph.rx}</Badge>}
                        <span className="text-xs text-subtle">{m.stock > 0 ? ph.inStock(m.stock) : ph.outOfStock}</span>
                      </div>
                    </div>
                    <Button size="sm" variant={cart[m.id] ? "secondary" : "primary"} disabled={m.stock < 1 || (cart[m.id] || 0) >= Math.min(m.stock, 100)}
                      onClick={() => { setPlaced(""); setQty(m, (cart[m.id] || 0) + 1); }}>
                      {cart[m.id] ? `${ph.inCart} (${cart[m.id]})` : ph.add}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
        </Card>

        <Card className="space-y-3 p-5">
          <p className="flex items-center gap-2 font-semibold"><ShoppingCart className="h-5 w-5" aria-hidden="true" />{ph.cart}</p>
          {placed && <p role="status" className="rounded-xl bg-health/10 px-3.5 py-2.5 text-sm">{ph.placed(placed)}</p>}
          {lines.length === 0 ? <p className="text-sm text-subtle">{ph.cartEmpty}</p> : (
            <>
              <ul className="divide-y divide-line">
                {lines.map(({ med, qty }) => (
                  <li key={med.id} className="flex items-center gap-2 py-2 text-sm">
                    <span className="min-w-0 flex-1">{med.name}{med.requiresPrescription && <span className="ml-1 text-xs text-warn">Rx</span>}<span className="block text-xs text-subtle">{rupees(med.price * qty)}</span></span>
                    <button className={qtyBtn} aria-label={`${ph.quantity} -1`} onClick={() => setQty(med, qty - 1)}><Minus className="h-4 w-4" /></button>
                    <span aria-label={ph.quantity} className="w-6 text-center">{qty}</span>
                    <button className={qtyBtn} aria-label={`${ph.quantity} +1`} disabled={qty >= Math.min(med.stock, 100)} onClick={() => setQty(med, qty + 1)}><Plus className="h-4 w-4" /></button>
                    <button className="text-xs text-subtle underline" onClick={() => setQty(med, 0)}>{ph.remove}</button>
                  </li>
                ))}
              </ul>
              <p className="flex justify-between font-semibold"><span>{ph.total}</span><span>{rupees(total)}</span></p>
              <p className="text-xs text-subtle">{ph.totalNote}</p>

              {rxNames.length > 0 && (
                <div className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
                  <p>{ph.rxNotice(rxNames.join(", "))}</p>
                  {rxError ? <p role="alert" className="mt-2 text-danger">{ph.rxLoadError}</p>
                    : rxList === null ? <p className="mt-2 text-subtle">…</p>
                    : rxList.length === 0 ? <p className="mt-2">{ph.noRx}</p>
                    : (
                      <label className="mt-2 block font-medium">{ph.attach}
                        <select className={`${input} mt-1`} value={rxId} onChange={(e) => setRxId(e.target.value)}>
                          <option value="">{ph.choose}</option>
                          {rxList.map((r) => <option key={r.id} value={r.id}>{rxLabel(r)}</option>)}
                        </select>
                      </label>
                    )}
                </div>
              )}

              <label className="block text-sm font-medium">{ph.address}
                <textarea className="mt-1 w-full rounded-xl border border-line bg-white p-3 text-[15px] outline-none focus:border-care focus:ring-4 focus:ring-care/15"
                  rows={2} maxLength={300} placeholder={ph.addressHint} value={address} onChange={(e) => setAddress(e.target.value)} />
              </label>
              {!user && <p className="text-sm text-subtle">{ph.signIn}</p>}
              {placeError && <ErrorNote message={`${ph.placeError} ${placeError}`} />}
              <Button className="w-full" loading={placing} disabled={!canPlace} onClick={place}>{ph.place}</Button>
            </>
          )}
        </Card>
      </div>

      {user && (
        <Card className="p-5">
          <p className="font-semibold">{ph.orders}</p>
          {ordersError ? <div className="mt-3"><ErrorNote message={`${ph.ordersError} (${ordersError})`} onRetry={loadOrders} /></div>
            : orders === null ? <div className="mt-3"><Spinner label={ph.ordersLoading} /></div>
            : orders.length === 0 ? <p className="mt-2 text-sm text-subtle">{ph.noOrders}</p>
            : (
              <ul className="mt-2 divide-y divide-line">
                {orders.map((o) => (
                  <li key={o.id} className="py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{o.id}</span>
                      <Badge tone={o.status === "DELIVERED" ? "health" : o.status === "CANCELLED" ? "neutral" : "care"} className="ml-auto">{ph.status[o.status] || o.status}</Badge>
                    </div>
                    <p className="text-subtle">{new Date(o.createdAt).toLocaleString(locale === "hi" ? "hi-IN" : "en-IN")} · {ph.items(o.items.length)} · {rupees(o.totalAmount)}</p>
                    <p>{o.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}</p>
                    {o.prescriptionAttached && <p className="text-xs text-subtle">{ph.prescription}: {o.prescriptionName}</p>}
                    {o.deliveryAddress && <p className="text-xs text-subtle">{o.deliveryAddress}</p>}
                  </li>
                ))}
              </ul>
            )}
        </Card>
      )}
    </section>
  );
}
