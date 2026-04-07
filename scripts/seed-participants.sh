#!/bin/bash

TOURNAMENT_ID="fcdd9e6d-fa75-4b35-8d18-2ae98178ffd1"
API="http://localhost:4000/v1"

FIRST_NAMES=("Armen" "Davit" "Karen" "Narek" "Tigran" "Aram" "Vahagn" "Levon" "Sargis" "Ruben" "Gevorg" "Artur" "Hayk" "Vardan" "Artak" "Mher" "Gagik" "Samvel" "Edgar" "Andranik")
LAST_NAMES=("Grigoryan" "Petrosyan" "Mkrtchyan" "Harutyunyan" "Hovhannisyan" "Sargsyan" "Avetisyan" "Ghazaryan" "Karapetyan" "Hakobyan" "Martirosyan" "Simonyan" "Muradyan" "Ohanyan" "Galstyan" "Asatryan" "Avagyan" "Stepanyan" "Nalbandyan" "Danielyan")
AGE_GROUPS=("juniors" "adults" "juniors" "adults" "adults" "juniors" "adults" "adults" "veterans" "adults" "adults" "juniors" "adults" "veterans" "adults" "adults" "juniors" "adults" "adults" "juniors")
HANDS=("right" "left" "right" "right" "left" "left" "right" "left" "right" "right" "left" "right" "left" "right" "left" "right" "right" "left" "left" "right")
WEIGHTS=(60 65 70 75 60 70 75 65 60 65 75 70 60 75 65 70 75 60 65 70)

SUCCESS=0
FAIL=0

for i in $(seq 0 19); do
  FIRST="${FIRST_NAMES[$i]}"
  LAST="${LAST_NAMES[$i]}"
  EMAIL="participant_${i}@gsm-test.com"
  AGE="${AGE_GROUPS[$i]}"
  HAND="${HANDS[$i]}"
  WEIGHT="${WEIGHTS[$i]}"

  # Try register
  RESP=$(curl -s -X POST "$API/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"Test1234\",\"firstName\":\"$FIRST\",\"lastName\":\"$LAST\"}")

  TOKEN=$(echo "$RESP" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

  # If already exists — login
  if [ -z "$TOKEN" ]; then
    RESP=$(curl -s -X POST "$API/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"login\":\"$EMAIL\",\"password\":\"Test1234\"}")
    TOKEN=$(echo "$RESP" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
  fi

  if [ -z "$TOKEN" ]; then
    echo "[$(($i+1))/20] SKIP: $FIRST $LAST — no token"
    FAIL=$(($FAIL+1))
    continue
  fi

  # Register for tournament
  REG=$(curl -s -X POST "$API/tournaments/$TOURNAMENT_ID/registrations" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"ageGroup\":\"$AGE\",\"hand\":\"$HAND\",\"weightKg\":$WEIGHT}")

  if echo "$REG" | grep -q '"id"'; then
    echo "[$(($i+1))/20] OK: $FIRST $LAST | $AGE | $HAND | ${WEIGHT}кг"
    SUCCESS=$(($SUCCESS+1))
  else
    MSG=$(echo "$REG" | grep -o '"message":"[^"]*"' | head -1)
    echo "[$(($i+1))/20] FAIL: $FIRST $LAST — $MSG"
    FAIL=$(($FAIL+1))
  fi
done

echo ""
echo "==============================="
echo "Итого: $SUCCESS успешно, $FAIL ошибок"
