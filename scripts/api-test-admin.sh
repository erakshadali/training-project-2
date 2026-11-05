#!/bin/bash
# End-to-end API test for RentEase step 4 (admin). Needs the dev server on 3217 with ADMIN_EMAIL/ADMIN_PASSWORD set.
B=${BASE_URL:-http://localhost:3000}
D=$(mktemp -d); cd "$D"
J='Content-Type: application/json'
DATE=$(date -d "+5 days" +%F); TOM=$(date -d "+1 day" +%F)
pj(){ python -c "import sys,json;d=json.load(sys.stdin);$1"; }
code(){ curl -s -o /dev/null -w "%{http_code}" "$@"; }
stock(){ curl -s $B/products/$1 | python -c "
import sys,re
t=sys.stdin.read().replace('\\\\\"','\"')
m=re.search(r'\"slug\":\"$1\".{0,2500}?\"stock\":(\d+)',t,re.S)
print(m.group(1) if m else '?')"; }

curl -s -c buyer.txt -X POST $B/api/auth/register -H "$J" -d '{"name":"Test Buyer","email":"buyer@example.com","phone":"9876543210","password":"Passw0rd-test"}' >/dev/null
curl -s -c admin.txt -X POST $B/api/auth/login -H "$J" -d '{"email":"admin@rentease.local","password":"ChangeMe-Local-123"}' >/dev/null

echo "1) access control: anon(401) buyer(403) admin(200) on /api/admin/stats: $(code $B/api/admin/stats) $(code -b buyer.txt $B/api/admin/stats) $(code -b admin.txt $B/api/admin/stats)"
echo "   anon/buyer on products, rentals, users, areas, claims, maintenance (all 401/403):"
for r in products rentals users areas claims maintenance; do echo -n "   $r: $(code $B/api/admin/$r) $(code -b buyer.txt $B/api/admin/$r) |"; done; echo

echo "2) product admin: create invalid(400) / valid(201) / edit price+stock / hide"
echo "   $(code -b admin.txt -X POST $B/api/admin/products -H "$J" -d '{"name":"x"}')"
NEW=$(curl -s -b admin.txt -X POST $B/api/admin/products -H "$J" -d '{"name":"Test Recliner Chair","category":"furniture","subcategory":"Chairs","art":"chair","tint":"#884422","blurb":"A comfy recliner for movie nights.","description":"A very comfortable recliner chair with a footrest for movie nights.","rent":499,"deposit":1500,"stock":5,"popular":false}')
echo "$NEW" | pj "p=d['product'];print('  ',p['id'],p['slug'],p['rent'],p['stock'])"
PID=$(echo "$NEW" | pj "print(d['product']['id'])")
curl -s -b admin.txt -X PATCH $B/api/admin/products/$PID -H "$J" -d '{"rent":549,"stock":7}' | pj "p=d['product'];print('   edited ->',p['rent'],p['stock'])"
echo "   visible on public page (200): $(code $B/products/test-recliner-chair)"
echo "   bad edit (400): $(code -b admin.txt -X PATCH $B/api/admin/products/$PID -H "$J" -d '{"rent":-5}')  buyer edit (403): $(code -b buyer.txt -X PATCH $B/api/admin/products/$PID -H "$J" -d '{"rent":1}')"
code -b admin.txt -X DELETE $B/api/admin/products/$PID >/dev/null
echo "   after hide, public page (404): $(code $B/products/test-recliner-chair)"

echo "3) service areas: add / duplicate(409) / invalid(400) / order to inactive city (400) / last-city guard"
curl -s -b admin.txt -X POST $B/api/admin/areas -H "$J" -d '{"name":"Jaipur"}' | pj "print('  ',d['area']['name'],d['area']['active'])"
echo "   dup: $(code -b admin.txt -X POST $B/api/admin/areas -H "$J" -d '{"name":"jaipur"}') invalid: $(code -b admin.txt -X POST $B/api/admin/areas -H "$J" -d '{"name":"<script>"}')"
PUNE=$(curl -s -b admin.txt $B/api/admin/areas | pj "print([a['id'] for a in d['areas'] if a['name']=='Pune'][0])")
code -b admin.txt -X PATCH $B/api/admin/areas/$PUNE -H "$J" -d '{"active":false}' >/dev/null
ord(){ curl -s -b buyer.txt -X POST $B/api/orders -H "$J" -d "{\"name\":\"Test Buyer\",\"phone\":\"9876543210\",\"email\":\"buyer@example.com\",\"address\":\"Flat 101 Test Apartments Sector 62\",\"city\":\"$1\",\"pincode\":\"201301\",\"deliveryDate\":\"$DATE\",\"slot\":\"9 AM to 12 PM\",\"payment\":\"cod\",\"lines\":$2}"; }
echo "   order to deactivated Pune (400): $(ord Pune '[{"productId":"p-chair","months":3,"qty":1}]' | pj "print(d.get('error'))")"
echo "   public page lists Pune? $(curl -s $B/ | grep -c 'Delivering in Pune')"

echo "4) full lifecycle: order -> deliver -> repair -> return with damage -> dispute -> uphold"
S0=$(stock queen-bed-with-storage)
ord Noida '[{"productId":"p-bed-queen","months":6,"qty":1},{"productId":"p-fridge-single","months":3,"qty":1}]' >/dev/null
S1=$(stock queen-bed-with-storage)
R=$(curl -s -b buyer.txt $B/api/rentals)
BED=$(echo "$R" | pj "print([r['id'] for r in d['rentals'] if r['productId']=='p-bed-queen'][0])")
FR=$(echo "$R" | pj "print([r['id'] for r in d['rentals'] if r['productId']=='p-fridge-single'][0])")
echo "   bed stock $S0 -> after order $S1"
echo "   deliver: buyer(403) admin(200) again(409): $(code -b buyer.txt -X POST $B/api/admin/rentals/$BED/deliver) $(code -b admin.txt -X POST $B/api/admin/rentals/$BED/deliver) $(code -b admin.txt -X POST $B/api/admin/rentals/$BED/deliver)"
echo "   return before delivery (409): $(code -b admin.txt -X POST $B/api/admin/rentals/$FR/return -H "$J" -d '{}')"
echo "   damage > deposit (400): $(code -b admin.txt -X POST $B/api/admin/rentals/$BED/return -H "$J" -d '{"damageCharge":999999,"damageNote":"way too much"}')  no note (400): $(code -b admin.txt -X POST $B/api/admin/rentals/$BED/return -H "$J" -d '{"damageCharge":500}')"
curl -s -b buyer.txt -X POST $B/api/rentals/$BED/return -H "$J" -d "{\"date\":\"$TOM\",\"slot\":\"9 AM to 12 PM\"}" >/dev/null
echo "   admin schedule board sees the pickup:"
curl -s -b admin.txt $B/api/admin/rentals | pj "[print('     ',r['name'][:18],r['phase'],r['customer']['name'],r['city']) for r in d['rentals'] if r['phase']=='Return scheduled']"
echo "   admin marks bed returned with 600 damage:"
curl -s -b admin.txt -X POST $B/api/admin/rentals/$BED/return -H "$J" -d '{"damageCharge":600,"damageNote":"Deep scratch on the headboard"}' | pj "print('     ',d['rental']['phase'],'claim',d['claimId'])"
S2=$(stock queen-bed-with-storage); echo "   bed stock after return: $S2 (expect $S0)"
echo "   return again (409): $(code -b admin.txt -X POST $B/api/admin/rentals/$BED/return -H "$J" -d '{}')"
CL=$(curl -s -b buyer.txt $B/api/claims | pj "print(d['claims'][0]['id'])")
curl -s -b buyer.txt $B/api/claims | pj "c=d['claims'][0];print('   customer sees claim:',c['amount'],c['status'],c['note'])"
echo "   dispute: other user/short(400)/valid: $(code -b buyer.txt -X POST $B/api/claims/$CL/dispute -H "$J" -d '{"message":"no"}')"
curl -s -b buyer.txt -X POST $B/api/claims/$CL/dispute -H "$J" -d '{"message":"That scratch was there when it was delivered."}' | pj "print('     ',d['claim']['status'])"
echo "   dispute twice (409): $(code -b buyer.txt -X POST $B/api/claims/$CL/dispute -H "$J" -d '{"message":"That scratch was there when it was delivered."}')"
echo "   admin: no reason(400) / uphold / again(409): $(code -b admin.txt -X PATCH $B/api/admin/claims/$CL -H "$J" -d '{"decision":"Upheld","note":"x"}')"
curl -s -b admin.txt -X PATCH $B/api/admin/claims/$CL -H "$J" -d '{"decision":"Waived","note":"Photos show it was pre-existing"}' | pj "print('     ',d['claim']['status'],'-',d['claim']['resolutionNote'])"
echo "   again (409): $(code -b admin.txt -X PATCH $B/api/admin/claims/$CL -H "$J" -d '{"decision":"Upheld","note":"changed my mind"}')"

echo "5) repairs queue"
curl -s -b admin.txt -X POST $B/api/admin/rentals/$FR/deliver >/dev/null
MR=$(curl -s -b buyer.txt -X POST $B/api/maintenance -H "$J" -d "{\"rentalId\":\"$FR\",\"category\":\"Not working\",\"description\":\"The fridge is not cooling properly\"}" | pj "print(d['request']['id'])")
curl -s -b admin.txt $B/api/admin/maintenance | pj "[print('   queue:',m['id'],m['status'],m['customer'],m['category']) for m in d['requests']]"
echo "   bad status (400): $(code -b admin.txt -X PATCH $B/api/admin/maintenance/$MR -H "$J" -d '{"status":"Done"}')"
curl -s -b admin.txt -X PATCH $B/api/admin/maintenance/$MR -H "$J" -d '{"status":"In progress","note":"Technician visiting tomorrow 11 AM"}' | pj "print('     ',d['request']['status'])"
curl -s -b admin.txt -X PATCH $B/api/admin/maintenance/$MR -H "$J" -d '{"status":"Resolved","note":"Gas refilled, cooling normal"}' | pj "r=d['request'];print('     ',r['status'],r['resolvedAt'] is not None)"
curl -s -b buyer.txt $B/api/maintenance | pj "r=d['requests'][0];print('   customer sees:',r['status'],'|',r['note'])"

echo "6) users: list, suspend buyer, blocked login, restore; admin cannot be suspended"
UID_=$(curl -s -b admin.txt $B/api/admin/users | pj "print([u['id'] for u in d['users'] if u['email']=='buyer@example.com'][0])")
ADM=$(curl -s -b admin.txt $B/api/admin/users | pj "print([u['id'] for u in d['users'] if u['role']=='admin'][0])")
curl -s -b admin.txt $B/api/admin/users | pj "[print('  ',u['email'],u['role'],'orders',u['orders'],'items',u['itemsRented'],'disabled',u['disabled']) for u in d['users']]"
code -b admin.txt -X PATCH $B/api/admin/users/$UID_ -H "$J" -d '{"disabled":true}' >/dev/null
echo "   suspended: existing session /me -> $(curl -s -b buyer.txt $B/api/auth/me)  login -> $(code -X POST $B/api/auth/login -H "$J" -d '{"email":"buyer@example.com","password":"Passw0rd-test"}')"
echo "   suspend admin (409): $(code -b admin.txt -X PATCH $B/api/admin/users/$ADM -H "$J" -d '{"disabled":true}')  bad id (404): $(code -b admin.txt -X PATCH $B/api/admin/users/zzz -H "$J" -d '{"disabled":true}')"
code -b admin.txt -X PATCH $B/api/admin/users/$UID_ -H "$J" -d '{"disabled":false}' >/dev/null
echo "   restored: login -> $(code -X POST $B/api/auth/login -H "$J" -d '{"email":"buyer@example.com","password":"Passw0rd-test"}')"

echo "7) stats"
curl -s -b admin.txt $B/api/admin/stats | pj "k=d['kpis'];print('  ',{x:(round(v,2) if isinstance(v,float) else v) for x,v in k.items()});print('   top product:',d['byProduct'][0]['name'],d['byProduct'][0]['mrr'],'| per-day:',[x['orders'] for x in d['ordersPerDay']])"
