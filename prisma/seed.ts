import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const products = [
    { reference: "H-001", gender: "HOMME", designation: "Léger", material: "100% Coton (BIO)", price: 35 },
    { reference: "H-002", gender: "HOMME", designation: "Classique", material: "100% Coton (BIO)", price: 39 },
    { reference: "H-003", gender: "HOMME", designation: "Oversize", material: "100% Coton (BIO)", price: 45 },
    { reference: "H-004", gender: "HOMME", designation: "Oversize Premium", material: "85% Coton / 15% Poly (BIO)", price: 50 },
    { reference: "H-005", gender: "HOMME", designation: "TYE & DYE Classique", material: "100% Coton (BIO)", price: 45 },
    { reference: "H-006", gender: "HOMME", designation: "Acide Classique", material: "100% Coton", price: 39 },
    { reference: "H-007", gender: "HOMME", designation: "Acide Premium", material: "100% Coton", price: 45 },
    { reference: "H-008", gender: "HOMME", designation: "Manches Longues Léger", material: "100% Coton (BIO)", price: 35 },
    { reference: "H-009", gender: "HOMME", designation: "Manches Longues Classique", material: "100% Coton", price: 39 },
    { reference: "H-010", gender: "HOMME", designation: "Débardeur", material: "100% Coton (BIO)", price: 29 },
    { reference: "H-011", gender: "HOMME", designation: "Sans Manche", material: "100% Coton (BIO)", price: 29 },
    { reference: "H-012", gender: "HOMME", designation: "Léger (Col V)", material: "100% Coton (BIO)", price: 35 },
    { reference: "H-013", gender: "HOMME", designation: "Classique (Col V)", material: "100% Coton", price: 35 },
    { reference: "H-014", gender: "HOMME", designation: "Eco Léger", material: "100% Coton (BIO)", price: 29 },
    { reference: "H-015", gender: "HOMME", designation: "Eco Classique", material: "100% Coton", price: 29 },
    { reference: "H-016", gender: "HOMME", designation: "Technique Léger", material: "100% Polyester", price: 29 },
    { reference: "H-017", gender: "HOMME", designation: "Technique Classique", material: "60% Coton / 40% Poly (BIO)", price: 35 },
    { reference: "H-018", gender: "HOMME", designation: "Technique Éco Classique", material: "100% Coton (BIO)", price: 29 },
    { reference: "H-019", gender: "HOMME", designation: "T-shirt Éco", material: "100% Coton (BIO)", price: 25 },
    { reference: "H-020", gender: "HOMME", designation: "Polo écoresponsable", material: "100% Coton (BIO)", price: 45 },
  ];

  console.log("🌱 Seed: Upserting products...");

  for (const product of products) {
    const upserted = await prisma.product.upsert({
      where: { reference: product.reference },
      update: { price: product.price },
      create: {
        reference: product.reference,
        gender: product.gender,
        designation: product.designation,
        material: product.material,
        price: product.price,
      },
    });
    console.log(`✓ ${upserted.reference} → ${upserted.price.toFixed(2)}€`);
  }

  console.log("✅ Seed completed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
