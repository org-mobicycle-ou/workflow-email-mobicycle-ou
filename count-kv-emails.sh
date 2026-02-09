#!/bin/bash

# Count emails in all KV namespaces

echo "Counting emails in all KV namespaces..."
echo ""

total=0

# Courts
echo "=== COURTS ==="
count=$(wrangler kv key list --namespace-id=4272a9a3567b4827b3e6b07a9e0ec07b 2>&1 | grep -c '"name"')
echo "Supreme Court: $count"
total=$((total + count))

count=$(wrangler kv key list --namespace-id=d730d43a0ff5452b9aa387fd6ab2640e 2>&1 | grep -c '"name"')
echo "Court of Appeals - Civil: $count"
total=$((total + count))

count=$(wrangler kv key list --namespace-id=ab4eb2fdf4844dab802e5006c53fed91 2>&1 | grep -c '"name"')
echo "Kings Bench Appeals: $count"
total=$((total + count))

count=$(wrangler kv key list --namespace-id=c0e294c679194bb2921f6faa83826d56 2>&1 | grep -c '"name"')
echo "Chancery Division: $count"
total=$((total + count))

count=$(wrangler kv key list --namespace-id=37c7b5e5e8a84e2a8e340cb0e1b39202 2>&1 | grep -c '"name"')
echo "Administrative Court: $count"
total=$((total + count))

count=$(wrangler kv key list --namespace-id=0dd9a961f8e54104a1c784fdd736d354 2>&1 | grep -c '"name"')
echo "Central London County Court: $count"
total=$((total + count))

count=$(wrangler kv key list --namespace-id=450d57986f6b47bd8e6a9881d48b0222 2>&1 | grep -c '"name"')
echo "Clerkenwell County Court: $count"
total=$((total + count))

echo ""
echo "=== TOTAL EMAILS IN ALL KV NAMESPACES: $total ==="
