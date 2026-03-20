require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Product = require('./models/productsSchema');
  const col = mongoose.connection.collection('pricealerts');
  const alerts = await col.find({}).toArray();

  for (const a of alerts) {
    const p = await Product.findById(a.productId);
    const v = p?.variants.find(v => v.color === a.variantColor && v.storage === a.variantStorage);
    const finalPrice = v ? (v.discountPrice || v.regularPrice) : (a.actualPrice || null);

    await col.updateOne(
      { _id: a._id },
      { $set: { finalPrice }, $unset: { actualPrice: '' } }
    );
    console.log(a.email, '| finalPrice:', finalPrice, '| targetPrice:', a.targetPrice, '| triggers:', a.targetPrice >= finalPrice);
  }

  console.log('Done');
  process.exit(0);
});
