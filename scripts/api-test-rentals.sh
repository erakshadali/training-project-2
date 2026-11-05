#!/bin/bash
# End-to-end API test for RentEase step 3 (rentals, maintenance, extend, return, cancel).
B=${BASE_URL:-http://localhost:3000}
D=$(mktemp -d); cd "$D"
J='Content-Type: application/json'
DATE=$(date -d "+5 days" +%F); TOM=$(date -d "+1 day" +%F)
pj(){ python -c "import sys,json;d=json.load(sys.stdin);$1"; }
code(){ curl -s -o /dev/null -w "%{http_code}" "$@"; }

curl -s -c buyer.txt -X POST $B/api/auth/register -H "$J" -d '{"name":"Test Buyer","email":"buyer@example.com","phone":"9876543210","password":"Passw0rd-test"}' >/dev/null
curl -s -c other.txt -X POST $B/api/auth/register -H "$J" -d '{"name":"Other Person","email":"other@example.com","phone":"9123456780","password":"Passw0rd-other"}' >/dev/null
curl -s -c admin.txt -X POST $B/api/auth/login -H "$J" -d '{"email":"admin@rentease.local","password":"ChangeMe-Local-123"}' >/dev/null

order(){ curl -s -b buyer.txt -X POST $B/api/orders -H "$J" -d "{\"name\":\"Test Buyer\",\"phone\":\"9876543210\",\"email\":\"buyer@example.com\",\"address\":\"Flat 101 Test Apartments Sector 62\",\"city\":\"Noida\",\"pincode\":\"201301\",\"deliveryDate\":\"$DATE\",\"slot\":\"9 AM to 12 PM\",\"payment\":\"cod\",\"lines\":$1}" >/dev/null; }
order '[{"productId":"p-ac","months":3,"qty":2},{"productId":"p-sofa-3","months":12,"qty":1}]'

echo "1) rentals created from the order:"
curl -s -b buyer.txt $B/api/rentals | pj "[print('  ',r['id'],r['name'][:20],'x',r['qty'],r['months'],'mo',r['rentPerMonth'],r['startDate'],'->',r['endDate'],r['phase']) for r in d['rentals']]"
AC=$(curl -s -b buyer.txt $B/api/rentals | pj "print([r['id'] for r in d['rentals'] if r['productId']=='p-ac'][0])")
SOFA=$(curl -s -b buyer.txt $B/api/rentals | pj "print([r['id'] for r in d['rentals'] if r['productId']=='p-sofa-3'][0])")

echo "2) maintenance before delivery (expect 409): $(code -b buyer.txt -X POST $B/api/maintenance -H "$J" -d "{\"rentalId\":\"$AC\",\"category\":\"Not working\",\"description\":\"The AC is not cooling at all\"}")"
echo "3) non-admin mark delivered (expect 403): $(code -b buyer.txt -X POST $B/api/admin/rentals/$AC/deliver)"
echo "4) admin marks AC delivered:"
curl -s -b admin.txt -X POST $B/api/admin/rentals/$AC/deliver | pj "r=d['rental'];print('  ',r['phase'],r['startDate'],'->',r['endDate'])"
echo "5) maintenance: short(400) badcat(400) valid(201) other-user(404):"
echo "  $(code -b buyer.txt -X POST $B/api/maintenance -H "$J" -d "{\"rentalId\":\"$AC\",\"category\":\"Not working\",\"description\":\"short\"}") $(code -b buyer.txt -X POST $B/api/maintenance -H "$J" -d "{\"rentalId\":\"$AC\",\"category\":\"Hacked\",\"description\":\"long enough description here\"}") $(code -b buyer.txt -X POST $B/api/maintenance -H "$J" -d "{\"rentalId\":\"$AC\",\"category\":\"Not working\",\"description\":\"The AC is not cooling the room\"}") $(code -b other.txt -X POST $B/api/maintenance -H "$J" -d "{\"rentalId\":\"$AC\",\"category\":\"Not working\",\"description\":\"trying someone elses rental\"}")"
echo "6) extend AC by 3 months (3 -> 6 month tier, rent should drop):"
curl -s -b buyer.txt -X POST $B/api/rentals/$AC/extend -H "$J" -d '{"addMonths":3}' | pj "r=d['rental'];print('  ',r['months'],'mo',r['rentPerMonth'],'/mo ends',r['endDate'],'ext',len(r['extensions']))"
echo "7) extend: invalid(400) not-delivered sofa(409) other-user(404): $(code -b buyer.txt -X POST $B/api/rentals/$AC/extend -H "$J" -d '{"addMonths":5}') $(code -b buyer.txt -X POST $B/api/rentals/$SOFA/extend -H "$J" -d '{"addMonths":3}') $(code -b other.txt -X POST $B/api/rentals/$AC/extend -H "$J" -d '{"addMonths":3}')"
echo "8) schedule early pickup tomorrow ($TOM): early-closure fee = one month rent x qty"
curl -s -b buyer.txt -X POST $B/api/rentals/$AC/return -H "$J" -d "{\"date\":\"$TOM\",\"slot\":\"12 PM to 3 PM\"}" | pj "r=d['rental'];print('  ',r['phase'],r['returnRequest'])"
echo "9) pickup in the past (400): $(code -b buyer.txt -X POST $B/api/rentals/$AC/return -H "$J" -d '{"date":"2020-01-01","slot":"9 AM to 12 PM"}')"
echo "10) cancel the pickup:"
curl -s -b buyer.txt -X DELETE $B/api/rentals/$AC/return | pj "r=d['rental'];print('  ',r['phase'],r['returnRequest'])"
echo "11) cancel sofa before delivery, stock returns:"
STK1=$(curl -s $B/products/three-seater-sofa | grep -o 'stock\\":[0-9]*' | head -1)
curl -s -b buyer.txt -X POST $B/api/rentals/$SOFA/cancel | pj "print('  ',d['rental']['phase'])"
STK2=$(curl -s $B/products/three-seater-sofa | grep -o 'stock\\":[0-9]*' | head -1)
echo "   stock before: $STK1  after: $STK2"
echo "12) cancel twice (409) / cancel delivered AC (409) / other user (404): $(code -b buyer.txt -X POST $B/api/rentals/$SOFA/cancel) $(code -b buyer.txt -X POST $B/api/rentals/$AC/cancel) $(code -b other.txt -X POST $B/api/rentals/$AC/cancel)"
echo "13) my maintenance requests:"
curl -s -b buyer.txt $B/api/maintenance | pj "[print('  ',x['id'],x['status'],x['category']) for x in d['requests']]"
echo "14) other user sees none of buyer's rentals:"
curl -s -b other.txt $B/api/rentals | pj "print('  ',len(d['rentals']),'rentals')"
