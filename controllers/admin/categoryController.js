const Category=require('../../models/categorySchema');
const Product=require('../../models/productsSchema')



const categoryInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const search = req.query.search || '';

    const query = search
      ? {
          $or: [
            { name: { $regex: new RegExp(search, 'i') } },
            { description: { $regex: new RegExp(search, 'i') } },
          ],
        }
      : {};

    const totalCategories = await Category.countDocuments(query);
    const categories = await Category.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.render('category', {
      cat: categories,
      currentPage: page,
      totalPages: Math.ceil(totalCategories / limit),
      searchQuery: search,
    });
  } catch (error) {
    console.error(error);
    res.redirect('/pageerror');
  }
};


const addCategory = async (req, res) => {
  try {
    const rawName = req.body.name || '';
    const rawDescription = req.body.description || '';

    const name = rawName.trim().replace(/\s+/g, ' ');
    const description = rawDescription.trim();

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const existingCategory = await Category.findOne({
      name: { $regex: `^${name}$`, $options: 'i' }
    });

    if (existingCategory) {
      return res.status(409).json({ error: 'Category already exists' });
    }

    const newCategory = new Category({ name, description });
    await newCategory.save();

    return res.status(200).json({ message: 'Category added successfully' });

  } catch (error) {
    console.error('Add Category Error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


const addCategoryOffer = async (req, res) => {
  try {
    const percentage = parseInt(req.body.percentage);
    const categoryId = req.body.categoryId;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ status: false, message: 'Category not found' });
    }

    const products = await Product.find({ category: category._id });

    const hasProductOffer = products.some((product) => product.productOffer > percentage);
    if (hasProductOffer) {
      return res.json({ status: false, message: 'Some products already have a higher product offer' });
    }

    await Category.updateOne({ _id: categoryId }, { $set: { categoryOffer: percentage } });

    for (const product of products) {
      product.productOffer = 0; // Remove individual product offers
      const discount = (percentage / 100) * product.regularPrice;
      product.salePrice = Math.round(product.regularPrice - discount);
      await product.save();
    }

    res.json({ status: true });
  } catch (error) {
    console.error('Error in addCategoryOffer:', error);
    res.status(500).json({ status: false, message: 'Internal server error' });
  }
};



const removeCategoryOffer = async (req, res) => {
  try {
    const categoryId = req.body.categoryId;
    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({ status: false, message: 'Category not found' });
    }

    const percentage = category.categoryOffer;
    const products = await Product.find({ category: category._id });

    if (products.length > 0) {
      for (const product of products) {
        product.salePrice += Math.floor(product.regularPrice * (percentage / 100));
        product.productOffer = 0;
        await product.save();
      }
    }

    category.categoryOffer = 0;
    await category.save();

    res.json({ status: true });
  } catch (error) {
    console.error('Error in removeCategoryOffer:', error);
    res.status(500).json({ status: false, message: 'Internal server Error' });
  }
};


const getListCategory=async(req,res)=>{
  try {
    let id=req.query.id;
    await Category.updateOne({_id:id},{$set:{isListed:false}});
    res.redirect('/admin/category');

  } catch (error) {
    res.redirect('/pageerror');
  }
}


const getUnlistCategory=async(req,res)=>{
  try {
    let id=req.query.id;
    await Category.updateOne({_id:id},{$set:{isListed:true}});
    res.redirect('/admin/category');
  } catch (error) {
    res.redirect('/pageerror');
  }
}

const getEditCategory = async (req, res) => {
  try {
    const id = req.query.id;
    const category = await Category.findById(id);
    const error = req.query.error;
    res.render('edit-category', { category, error });
  } catch (error) {
    res.redirect('/pageerror');
  }
};

const editCategory = async (req, res) => {
  try {
    const id = req.params.id;
    const rawName = req.body.categoryName || '';
    const rawDescription = req.body.description || '';

    const categoryName = rawName.trim();
    const description = rawDescription.trim();

    if (!categoryName) {
      return res.redirect(`/admin/editCategory?id=${id}&error=Category name cannot be empty`);
    }

    // Check for duplicate (case-insensitive, trimmed)
    const existingCategory = await Category.findOne({
      _id: { $ne: id },
      name: { $regex: new RegExp(`^${categoryName}$`, 'i') }
    });

    if (existingCategory) {
      return res.redirect(`/admin/editCategory?id=${id}&error=Category name already exists`);
    }

    const updatedCategory = await Category.findByIdAndUpdate(
      id,
      { name: categoryName, description },
      { new: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ error: 'Category not found' });
    }

    res.redirect('/admin/category');

  } catch (error) {
    console.error('Error updating category:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};




module.exports={
  categoryInfo,
  addCategory,
  addCategoryOffer,
  removeCategoryOffer,
  getListCategory,
  getUnlistCategory,
  getEditCategory,
  editCategory  
}