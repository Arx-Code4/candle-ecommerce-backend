import { prisma } from '../src/config/db.js';
import bcrypt from 'bcrypt';

async function main() {
  console.log('Seeding database...');

  // Create an Admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@candle.com' },
    update: {},
    create: {
      email: 'admin@candle.com',
      password: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
    },
  });
  console.log('Admin user created: admin@candle.com / admin123');

  // Create a normal user
  const userPassword = await bcrypt.hash('user123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'user@candle.com' },
    update: {},
    create: {
      email: 'user@candle.com',
      password: userPassword,
      name: 'Test User',
      role: 'CUSTOMER',
    },
  });
  console.log('Test user created: user@candle.com / user123');

  // Create some products
  const products = [
    {
      name: 'Midnight Citrus',
      description: 'A refreshing blend of lemon, lime, and woody notes.',
      price: '450.00',
      variants: [
        { scent: 'citrus', size: '8oz', stock: 50 },
        { scent: 'citrus', size: '12oz', stock: 30 },
      ],
    },
    {
      name: 'Forest Retreat',
      description: 'Deep woody aroma for a calming environment.',
      price: '650.00',
      variants: [
        { scent: 'woody', size: '12oz', stock: 100 },
        { scent: 'woody', size: 'travel tin', stock: 200 },
      ],
    },
    {
      name: 'Sweet Vanilla Dreams',
      description: 'Warm and sweet vanilla for cozy evenings.',
      price: '300.00',
      variants: [{ scent: 'sweet', size: '8oz', stock: 15 }],
    },
    {
      name: 'Rose Garden',
      description: 'Floral notes bringing the freshness of spring.',
      price: '400.00',
      variants: [
        { scent: 'floral', size: '12oz', stock: 40 },
        { scent: 'floral', size: 'travel tin', stock: 10 },
      ],
    },
  ];

  for (const p of products) {
    await prisma.product.create({
      data: {
        name: p.name,
        description: p.description,
        price: p.price,
        photos: {
          create: [
            {
              url: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=600&q=80',
              sortOrder: 0,
            },
          ],
        },
        variants: {
          create: p.variants,
        },
      },
    });
  }

  console.log('Seeded products!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
