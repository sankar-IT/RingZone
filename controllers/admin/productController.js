const Product = require('../../models/productsSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');
const { checkAlertsForProduct } = require('../../helpers/realtimePriceAlert');

const getProductPage = async (req, res) => {
  try {
    const brands = await Brand.find({ isBlocked: false });
    const categories = await Category.find({ isListed: true });
    res.render('product-add', { brands, categories });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error loading product form');
  }
};

const addProduct = async (req, res) => {
  try {
    const { productName, brand, category, description } = req.body;

    let variants = [];
    try {
      if (req.body.variants && req.body.variants.trim() !== '') {
        variants = JSON.parse(req.body.variants);
      }
    } catch (err) {
      return res.status(400).json({ error: 'Invalid variants format' });
    }

    const productImages = req.files?.productImages
      ? req.files.productImages.map(f => `uploads/products/${f.filename}`)
      : [];

    const processedVariants = variants.map((variant, index) => {
      const variantId = `variant-${index + 1}`;
      const variantFiles = req.files?.[`variantImages-${variantId}`] || [];
      const variantImages = variantFiles.map(f => `uploads/products/${f.filename}`);
      return {
        color: variant.color,
        storage: variant.storage,
        regularPrice: Number(variant.regularPrice),
        discountPrice: Number(variant.regularPrice),
        quantity: Number(variant.quantity),
        images: variantImages
      };
    });

    const newProduct = new Product({
      productName, brand, category, description,
      images: productImages,
      variants: processedVariants
    });

    await newProduct.save();
    return res.json({ success: true, message: 'Product added successfully' });
  } catch (error) {
    console.error('Error adding product:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const addProductList = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const perPage = 10;
    const searchQuery = req.query.search || '';

    const filter = searchQuery
      ? { productName: { $regex: searchQuery, $options: 'i' } }
      : {};

    const totalProducts = await Product.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / perPage);

    const products = await Product.find(filter)
      .populate('brand category')
      .skip((page - 1) * perPage)
      .limit(perPage);

    res.render('productlist', { products, currentPage: page, totalPages, perPage, searchQuery });
  } catch (error) {
    console.error('Error loading product list:', error);
    res.status(500).send('Error loading products');
  }
};

const productBlock = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false });
    product.isBlocked = !product.isBlocked;
    await product.save();
    res.json({ success: true, isBlocked: product.isBlocked });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
};

const editProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('brand category');
    const brands = await Brand.find({ isBlocked: false });
    const categories = await Category.find({ isListed: true });
    res.render('product-edit', { product, brands, categories });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error loading product');
  }
};

const updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    let variants = [];
    try {
      if (req.body.variants && req.body.variants.trim() !== '') {
        variants = JSON.parse(req.body.variants);
      }
    } catch (err) {
      return res.status(400).json({ error: 'Invalid variants format' });
    }

    let removedVariantImages = {};
    try {
      if (req.body.removedVariantImages && req.body.removedVariantImages.trim() !== '') {
        removedVariantImages = JSON.parse(req.body.removedVariantImages);
      }
    } catch (err) {
      return res.status(400).json({ error: 'Invalid removedVariantImages format' });
    }

    const existingProduct = await Product.findById(productId);
    if (!existingProduct) return res.status(404).json({ error: 'Product not found' });

    const updateData = {
      productName: req.body.productName,
      description: req.body.description,
      brand: req.body.brand,
      category: req.body.category,
      images: existingProduct.images,
      variants: []
    };

    if (req.files?.productImages) {
      const newImages = Array.isArray(req.files.productImages)
        ? req.files.productImages : [req.files.productImages];
      updateData.images = [
        ...(req.body.existingProductImages || []),
        ...newImages.map(f => `uploads/products/${f.filename}`)
      ];
    } else if (req.body.existingProductImages) {
      updateData.images = Array.isArray(req.body.existingProductImages)
        ? req.body.existingProductImages : [req.body.existingProductImages];
    }

    variants.forEach((variant, index) => {
      const variantId = `variant-${index + 1}`;
      const existingVariant = existingProduct.variants[index] || {};
      let variantImages = existingVariant.images || [];

      if (removedVariantImages[variantId]) {
        variantImages = variantImages.filter(img => !removedVariantImages[variantId].includes(img));
      }

      const newImages = req.files?.[`variantImages-${variantId}`];
      if (newImages) {
        const filesArray = Array.isArray(newImages) ? newImages : [newImages];
        variantImages.push(...filesArray.map(f => `uploads/products/${f.filename}`));
      }

      // discountPrice = regularPrice (offers applied separately via addProductOffer)
      const regularPrice = Number(variant.regularPrice);
      const discountPrice = regularPrice;

      updateData.variants.push({ ...variant, regularPrice, discountPrice, images: variantImages });
    });

    await Product.findByIdAndUpdate(productId, updateData, { new: true });

    // Trigger real-time price alerts immediately after price update
    console.log(`\n🚀 Product ${productId} updated — checking price alerts...`);
    await checkAlertsForProduct(productId);
    console.log(`✅ Alert check done`);

    res.redirect('/admin/productlist');
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product', details: error.message });
  }
};

const addProductOffer = async (req, res) => {
  try {
    const { productId } = req.params;
    const { offer } = req.body;

    if (isNaN(offer) || offer <= 0 || offer > 90) {
      return res.status(400).json({ success: false, message: 'Invalid offer percentage' });
    }

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    product.offer = offer;
    product.variants.forEach(variant => {
      const discountAmount = Math.floor((variant.regularPrice * offer) / 100);
      variant.discountPrice = variant.regularPrice - discountAmount;
    });

    await product.save();
    await checkAlertsForProduct(productId);

    res.json({ success: true, message: 'Product offer applied successfully' });
  } catch (error) {
    console.error('Error in addProductOffer:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const removeProductOffer = async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    product.offer = 0;
    product.variants.forEach(variant => {
      variant.discountPrice = variant.regularPrice;
    });

    await product.save();
    await checkAlertsForProduct(productId);

    res.json({ success: true, message: 'Product offer removed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getProductPage,
  addProduct,
  addProductList,
  productBlock,
  editProduct,
  updateProduct,
  addProductOffer,
  removeProductOffer
};
