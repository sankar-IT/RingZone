const Product = require('../../models/productsSchema');
const Category = require('../../models/categorySchema');
const Brand = require('../../models/brandSchema');


const getProductPage = async (req, res) => {
  try {
    const brands = await Brand.find({isBlocked:false});
    const categories = await Category.find({isListed:true});
    res.render('product-add', { brands, categories });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error loading product form');
  }
};


const addProduct = async (req, res) => {
  try {
    const { productName, brand, category, description, variants } = req.body;

    const categoryData = await Category.findById(category);
    if (!categoryData) {
      return res.status(400).json({ success: false, message: 'Invalid category' });
    }

    const categoryOffer = categoryData.categoryOffer || 0; 

   
    const productImages = req.files
      .filter(file => file.fieldname === 'productImages')
      .map(file => `uploads/products/${file.filename}`);

    
    const parsedVariants = JSON.parse(variants).map((variant, index) => {
      const fieldname = `variantImages-variant-${index + 1}`;
      const variantImages = req.files
        .filter(file => file.fieldname === fieldname)
        .map(file => `uploads/products/${file.filename}`);

      const regularPrice = parseFloat(variant.regularPrice) || 0;
      const discount = (categoryOffer / 100) * regularPrice;
      const discountPrice = Math.round(regularPrice - discount); 

      return {
        ...variant,
        images: variantImages,
        regularPrice,
        discountPrice 
      };
    });

   
    const newProduct = new Product({
      productName,
      brand,
      category,
      description,
      images: productImages,
      variants: parsedVariants
    });

    await newProduct.save();

    res.status(201).json({
      success: true,
      message: 'Product added successfully',
      product: newProduct
    });
  } catch (err) {
    console.error('Error while saving product:', err);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: err.message
    });
  }
};

const addProductList = async (req, res) => {
  try {
    const perPage = 5;
    const page = parseInt(req.query.page) || 1;
    const searchQuery = req.query.search || '';

    let query = {};
    if (searchQuery.trim()) {
      query = {
        $or: [
          { productName: { $regex: searchQuery, $options: 'i' } },
          { description: { $regex: searchQuery, $options: 'i' } }
        ]
      };
    }

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / perPage);

    const products = await Product.find(query)
      .populate('brand')
      .populate('category')
      .skip((perPage * page) - perPage)
      .limit(perPage)
      .lean();

    res.render('productlist', {
      products,
      currentPage: page,
      totalPages,
      perPage,
      searchQuery
    });

  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};


const productBlock = async (req, res) => {
  try {
    const { block } = req.body;
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.isBlocked = block;
    await product.save();

    res.status(200).json({
      success: true,
      message: `Product ${block ? 'blocked' : 'unblocked'} successfully`,
    });
  } catch (error) {
    console.error('Error blocking/unblocking product:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.',
    });
  }
};

// Edit product 
const editProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    const product = await Product.findById(productId)
      .populate('brand')
      .populate('category');

    if (!product) {
      return res.status(404).send('Product not found');
    }

    const brands = await Brand.find();
    const categories = await Category.find();

    res.render('product-edit', { product, brands, categories });
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred');
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
      if (!Array.isArray(variants)) {
        throw new Error('Variants must be an array');
      }
    } catch (err) {
      return res.status(400).json({ error: 'Invalid variants format', details: err.message });
    }

   
    let removedVariantImages = {};
    try {
      if (req.body.removedVariantImages && req.body.removedVariantImages.trim() !== '') {
        removedVariantImages = JSON.parse(req.body.removedVariantImages);
      }
    } catch (err) {
      return res.status(400).json({ error: 'Invalid removedVariantImages format', details: err.message });
    }

    
    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    
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
        ? req.files.productImages
        : [req.files.productImages];

      updateData.images = [
        ...(req.body.existingProductImages || []),
        ...newImages.map(file => `uploads/products/${file.filename}`)
      ];
    } else if (req.body.existingProductImages) {
      updateData.images = Array.isArray(req.body.existingProductImages)
        ? req.body.existingProductImages
        : [req.body.existingProductImages];
    }

    variants.forEach((variant, index) => {
      const variantId = `variant-${index + 1}`;
      const existingVariant = existingProduct.variants[index] || {};
      let variantImages = existingVariant.images || [];



      if (removedVariantImages[variantId]) {
        variantImages = variantImages.filter(
          img => !removedVariantImages[variantId].includes(img)
        );
      }

      const newImages = req.files?.[`variantImages-${variantId}`];
      if (newImages) {
        const filesArray = Array.isArray(newImages) ? newImages : [newImages];
        variantImages.push(...filesArray.map(file => `uploads/products/${file.filename}`));
      }

      updateData.variants.push({
        ...variant,
        images: variantImages
      });

    });


    await Product.findByIdAndUpdate(productId, updateData, { new: true });
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
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    
    product.offer = offer;
    product.variants.forEach(variant => {
      const discountAmount = Math.floor((variant.regularPrice * offer) / 100);
      variant.discountPrice = variant.regularPrice - discountAmount;
    });

    await product.save();

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
    if (!product) {
      console.log("fkjbfjbvkhbf");
      
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    
    product.offer = 0;
    product.variants.forEach(variant => {
      variant.discountPrice = variant.regularPrice;
    });

    await product.save();

    res.json({ success: true, message: 'Product offer removed successfully' });
  } catch (error) {
    console.log('Error in removeProductOffer:', error);
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