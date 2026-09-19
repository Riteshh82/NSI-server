/**
 * Coppera — Database Seeder
 *
 * Seeds MongoDB Atlas with:
 *   - 6 categories
 *   - 8 products
 *   - 1 admin user (from ADMIN_EMAIL / ADMIN_PASSWORD env vars)
 *
 * Usage:
 *   npm run seed
 *
 * Safe to run multiple times — uses upsert so it won't duplicate data.
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { Category } from "./models/Category";
import { Product } from "./models/Product";
import { Admin } from "./models/Admin";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("❌  MONGODB_URI is not set. Copy .env.example → .env and fill in your Atlas URI.");
  process.exit(1);
}

// ── Seed data ────────────────────────────────────────────────────────────────

const img = (keywords: string, seed: string) =>
  `https://images.unsplash.com/${seed}?auto=format&fit=crop&w=1200&q=80&${encodeURIComponent(keywords)}`;

const PHOTO = {
  copperSheet: "photo-1587582140833-cb54e5c7f8e6",
  copperTexture: "photo-1622467827417-bec7da96f1ba",
  hammeredMetal: "photo-1620641622295-5a1c8d3c0a5d",
  interiorWarm: "photo-1600585154340-be6161a56a0c",
  kitchenBacksplash: "photo-1556911220-bff31c812dba",
  loftInterior: "photo-1502672260266-1c1ef2d93688",
  bathroomTile: "photo-1552321554-5fefe8c9ef14",
  darkInterior: "photo-1600607687920-4e2a09cf159d",
  wallPanel: "photo-1615873968403-89e068629265",
  architecture: "photo-1487958449943-2429e8be8625",
  facade: "photo-1481253127861-534498168948",
};

const CATEGORIES = [
  {
    name: "Copper Tiles",
    slug: "copper-tiles",
    description: "Classic and hammered copper tiles for walls, backsplashes and feature panels.",
    image: img("copper,tile", PHOTO.copperTexture),
    productCount: 3,
  },
  {
    name: "Copper Wall Panels",
    slug: "copper-wall-panels",
    description: "Large-format panels engineered for commercial and residential feature walls.",
    image: img("copper,panel,wall", PHOTO.wallPanel),
    productCount: 2,
  },
  {
    name: "Decorative Copper",
    slug: "decorative-copper",
    description: "Mosaic and ornamental copper surfaces for statement interiors.",
    image: img("copper,mosaic", PHOTO.kitchenBacksplash),
    productCount: 1,
  },
  {
    name: "Textured Copper",
    slug: "textured-copper",
    description: "Hand-finished, richly textured copper for tactile architectural surfaces.",
    image: img("copper,texture,metal", PHOTO.hammeredMetal),
    productCount: 1,
  },
  {
    name: "Antique Copper",
    slug: "antique-copper",
    description: "Aged and patinated copper finishes for heritage and character-led projects.",
    image: img("antique,copper", PHOTO.darkInterior),
    productCount: 1,
  },
  {
    name: "Architectural Surfaces",
    slug: "architectural-surfaces",
    description: "Facade-grade copper cladding and surfaces for commercial architecture.",
    image: img("copper,facade,architecture", PHOTO.facade),
    productCount: 1,
  },
];

const PRODUCTS = [
  {
    slug: "classic-copper-tile",
    name: "Classic Copper Tile",
    category: "Copper Tiles",
    shortDescription: "A refined, smooth-finish copper tile for timeless interiors.",
    fullDescription:
      "The Classic Copper Tile brings a warm, understated shine to any wall. Precision-pressed from solid copper sheet and finished by hand, it is equally at home behind a kitchen range or across an entire feature wall. Its smooth surface reflects light softly, deepening in tone over years of use.",
    tags: ["Bestseller", "Smooth Finish"],
    images: [
      img("copper,tile,smooth", PHOTO.copperSheet),
      img("copper,tile,closeup", PHOTO.copperTexture),
      img("copper,kitchen", PHOTO.kitchenBacksplash),
    ],
    specifications: {
      material: "99.9% Pure Copper",
      finish: "Polished Smooth",
      dimensions: "150mm x 150mm x 1.2mm",
      weight: "0.24 kg / tile",
      color: "Natural Copper",
      applications: ["Kitchen Backsplash", "Feature Walls", "Bar Interiors"],
    },
    finishes: ["Polished", "Satin", "Matte"],
    amazonUrl: "https://www.amazon.in/s?k=classic+copper+tile",
    flipkartUrl: "https://www.flipkart.com/search?q=classic+copper+tile",
    featured: true,
    bulkAvailable: true,
    status: "Published" as const,
    views: 2140,
  },
  {
    slug: "hammered-copper-panel",
    name: "Hammered Copper Panel",
    category: "Copper Wall Panels",
    shortDescription: "Hand-hammered texture that catches light from every angle.",
    fullDescription:
      "Each Hammered Copper Panel is worked by hand into an irregular, faceted texture that plays with light throughout the day. Built for large-format installations, it is a favourite among architects looking to add depth and craft to lobbies, restaurants and boutique retail spaces.",
    tags: ["Handcrafted", "Large Format"],
    images: [
      img("hammered,copper", PHOTO.hammeredMetal),
      img("copper,wall,panel", PHOTO.wallPanel),
      img("loft,copper,interior", PHOTO.loftInterior),
    ],
    specifications: {
      material: "99.9% Pure Copper",
      finish: "Hand-Hammered",
      dimensions: "600mm x 300mm x 1.5mm",
      weight: "1.1 kg / panel",
      color: "Warm Copper",
      applications: ["Lobbies", "Feature Walls", "Retail Interiors"],
    },
    finishes: ["Hammered Natural", "Hammered Dark"],
    amazonUrl: "https://www.amazon.in/s?k=hammered+copper+panel",
    flipkartUrl: "https://www.flipkart.com/search?q=hammered+copper+panel",
    featured: true,
    bulkAvailable: true,
    status: "Published" as const,
    views: 1560,
  },
  {
    slug: "antique-copper-tile",
    name: "Antique Copper Tile",
    category: "Antique Copper",
    shortDescription: "Deep, patinated tones for character-rich, heritage-style spaces.",
    fullDescription:
      "The Antique Copper Tile is chemically aged to develop a rich, variegated patina reminiscent of centuries-old copperwork. No two tiles are identical, making every installation genuinely one-of-a-kind. A favourite for heritage restorations and characterful residential interiors.",
    tags: ["Aged Finish", "One-of-a-kind"],
    images: [
      img("antique,copper,tile", PHOTO.darkInterior),
      img("aged,copper", PHOTO.copperTexture),
      img("heritage,interior", PHOTO.interiorWarm),
    ],
    specifications: {
      material: "99.9% Pure Copper",
      finish: "Antique Patina",
      dimensions: "150mm x 150mm x 1.2mm",
      weight: "0.24 kg / tile",
      color: "Aged Bronze-Copper",
      applications: ["Heritage Interiors", "Feature Walls", "Fireplaces"],
    },
    finishes: ["Light Patina", "Deep Patina"],
    amazonUrl: "https://www.amazon.in/s?k=antique+copper+tile",
    flipkartUrl: "https://www.flipkart.com/search?q=antique+copper+tile",
    featured: true,
    bulkAvailable: true,
    status: "Published" as const,
    views: 980,
  },
  {
    slug: "brushed-copper-tile",
    name: "Brushed Copper Tile",
    category: "Copper Tiles",
    shortDescription: "A soft, linear brushed texture with a contemporary matte glow.",
    fullDescription:
      "Brushed in a single direction for a fine linear texture, this tile offers a quieter, more contemporary read on copper — ideal for minimalist kitchens, bathrooms and commercial counters that want warmth without shine.",
    tags: ["Matte", "Contemporary"],
    images: [
      img("brushed,copper", PHOTO.copperSheet),
      img("bathroom,copper,tile", PHOTO.bathroomTile),
      img("modern,kitchen,metal", PHOTO.loftInterior),
    ],
    specifications: {
      material: "99.9% Pure Copper",
      finish: "Brushed Matte",
      dimensions: "150mm x 150mm x 1.2mm",
      weight: "0.24 kg / tile",
      color: "Soft Copper",
      applications: ["Bathrooms", "Commercial Counters", "Feature Walls"],
    },
    finishes: ["Brushed Matte", "Brushed Satin"],
    amazonUrl: "https://www.amazon.in/s?k=brushed+copper+tile",
    flipkartUrl: "https://www.flipkart.com/search?q=brushed+copper+tile",
    featured: true,
    bulkAvailable: true,
    status: "Published" as const,
    views: 760,
  },
  {
    slug: "rose-copper-tile",
    name: "Rose Copper Tile",
    category: "Copper Tiles",
    shortDescription: "A pink-toned copper alloy tile with a luminous, jewel-like finish.",
    fullDescription:
      "Blended with a touch of rose-gold alloy, this tile carries a softer, pinker warmth than pure copper — well suited to boutique interiors, powder rooms and hospitality spaces looking for a distinctive, jewel-toned accent.",
    tags: ["Alloy Finish", "Statement Piece"],
    images: [
      img("rose,gold,tile", PHOTO.kitchenBacksplash),
      img("pink,metal,texture", PHOTO.copperTexture),
      img("boutique,interior", PHOTO.interiorWarm),
    ],
    specifications: {
      material: "Copper-Rose Gold Alloy",
      finish: "Polished",
      dimensions: "150mm x 150mm x 1.2mm",
      weight: "0.23 kg / tile",
      color: "Rose Copper",
      applications: ["Powder Rooms", "Hospitality Interiors", "Feature Walls"],
    },
    finishes: ["Polished", "Satin"],
    amazonUrl: "https://www.amazon.in/s?k=rose+copper+tile",
    flipkartUrl: "https://www.flipkart.com/search?q=rose+copper+tile",
    featured: false,
    bulkAvailable: true,
    status: "Published" as const,
    views: 540,
  },
  {
    slug: "copper-mosaic",
    name: "Copper Mosaic",
    category: "Decorative Copper",
    shortDescription: "Small-format mosaic tiles arranged for intricate decorative detail.",
    fullDescription:
      "Composed of small hexagonal and square copper pieces mounted on a flexible mesh backing, the Copper Mosaic is designed for curved surfaces, borders and decorative insets where a larger tile can't reach.",
    tags: ["Mosaic", "Decorative"],
    images: [
      img("copper,mosaic,tile", PHOTO.hammeredMetal),
      img("mosaic,pattern,metal", PHOTO.wallPanel),
      img("decorative,interior", PHOTO.darkInterior),
    ],
    specifications: {
      material: "99.9% Pure Copper",
      finish: "Polished Mosaic",
      dimensions: "300mm x 300mm sheet",
      weight: "0.6 kg / sheet",
      color: "Natural Copper",
      applications: ["Decorative Borders", "Bar Fronts", "Accent Walls"],
    },
    finishes: ["Polished", "Antique"],
    amazonUrl: "https://www.amazon.in/s?k=copper+mosaic+tile",
    flipkartUrl: "https://www.flipkart.com/search?q=copper+mosaic+tile",
    featured: false,
    bulkAvailable: true,
    status: "Published" as const,
    views: 410,
  },
  {
    slug: "textured-copper-panel",
    name: "Textured Copper Panel",
    category: "Textured Copper",
    shortDescription: "A deeply grooved panel that adds dramatic depth to large walls.",
    fullDescription:
      "Engineered with a repeating ridged texture, the Textured Copper Panel is built for scale — designed to be viewed across a room, where its grooves catch shadow and light to create a constantly shifting surface.",
    tags: ["Deep Texture", "Commercial Grade"],
    images: [
      img("textured,metal,panel", PHOTO.wallPanel),
      img("copper,ridges", PHOTO.hammeredMetal),
      img("commercial,interior,metal", PHOTO.loftInterior),
    ],
    specifications: {
      material: "99.9% Pure Copper",
      finish: "Ridged Texture",
      dimensions: "600mm x 300mm x 1.8mm",
      weight: "1.3 kg / panel",
      color: "Natural Copper",
      applications: ["Commercial Lobbies", "Auditoriums", "Feature Walls"],
    },
    finishes: ["Natural", "Dark Oxide"],
    amazonUrl: "https://www.amazon.in/s?k=textured+copper+panel",
    flipkartUrl: "https://www.flipkart.com/search?q=textured+copper+panel",
    featured: false,
    bulkAvailable: true,
    status: "Published" as const,
    views: 305,
  },
  {
    slug: "premium-copper-wall-tile",
    name: "Premium Copper Wall Tile",
    category: "Architectural Surfaces",
    shortDescription: "Facade-grade copper tile engineered for exterior architectural use.",
    fullDescription:
      "Built to a heavier gauge and weatherproofed for exterior exposure, the Premium Copper Wall Tile is our flagship architectural product — specified by studios for facades, canopies and outdoor feature walls that need to perform as well as they look.",
    tags: ["Facade Grade", "Weatherproof"],
    images: [
      img("copper,facade", PHOTO.facade),
      img("architecture,metal,building", PHOTO.architecture),
      img("copper,exterior,wall", PHOTO.copperSheet),
    ],
    specifications: {
      material: "99.9% Pure Copper",
      finish: "Weatherproof Coated",
      dimensions: "300mm x 300mm x 2mm",
      weight: "0.9 kg / tile",
      color: "Natural Copper (weathers to verdigris)",
      applications: ["Facades", "Canopies", "Outdoor Feature Walls"],
    },
    finishes: ["Natural", "Pre-Weathered"],
    amazonUrl: "https://www.amazon.in/s?k=premium+copper+wall+tile",
    flipkartUrl: "https://www.flipkart.com/search?q=premium+copper+wall+tile",
    featured: false,
    bulkAvailable: true,
    status: "Draft" as const,
    views: 128,
  },
];

// ── Main ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("\n🌱  Coppera Seeder starting…");
  await mongoose.connect(MONGODB_URI!);
  console.log("✅  Connected to MongoDB Atlas\n");

  // ── Categories ──
  console.log("📁  Seeding categories…");
  for (const cat of CATEGORIES) {
    await Category.findOneAndUpdate({ slug: cat.slug }, cat, { upsert: true, new: true });
    console.log(`   ✓  ${cat.name}`);
  }

  // ── Products ──
  console.log("\n📦  Seeding products…");
  for (const prod of PRODUCTS) {
    await Product.findOneAndUpdate({ slug: prod.slug }, prod, { upsert: true, new: true });
    console.log(`   ✓  ${prod.name}`);
  }

  // ── Admin ──
  console.log("\n👤  Seeding admin user…");
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@coppera.in").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "admin123";
  const existing = await Admin.findOne({ email: adminEmail });
  if (!existing) {
    const hash = await bcrypt.hash(adminPassword, 12);
    await Admin.create({ email: adminEmail, passwordHash: hash });
    console.log(`   ✓  Admin created: ${adminEmail}`);
  } else {
    console.log(`   ℹ  Admin already exists: ${adminEmail} (skipped)`);
  }

  console.log("\n🎉  Seeding complete!\n");
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("❌  Seeder error:", err);
  process.exit(1);
});
