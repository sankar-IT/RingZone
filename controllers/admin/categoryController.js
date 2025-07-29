const Category=require('../../models/categorySchema');
const Product=require('../../models/productsSchema')



const categoryInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
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
    const { categoryId, percentage } = req.body;

    if (isNaN(percentage) || percentage <= 0) {
      return res.status(400).json({ status: false, message: 'Invalid offer percentage' });
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ status: false, message: 'Category not found' });
    }

    const products = await Product.find({ category: category._id });

    for (const product of products) {
      for (const variant of product.variants) {
        const discount = Math.floor((variant.regularPrice * percentage) / 100);
        variant.discountPrice = variant.regularPrice - discount;
      }
      await product.save();
    }

    await Category.updateOne(
      { _id: categoryId },
      { $set: { categoryOffer: percentage } }
    );

    res.json({ status: true, message: 'Category offer applied successfully' });
  } catch (error) {
    console.error('Error in addCategoryOffer:', error);
    res.status(500).json({ status: false, message: 'Internal server error' });
  }
};


const removeCategoryOffer = async (req, res) => {
  try {
    const { categoryId } = req.body;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ status: false, message: 'Category not found' });
    }

    const products = await Product.find({ category: category._id });

    for (const product of products) {
      for (const variant of product.variants) {
        variant.discountPrice = variant.regularPrice; 
      }
      await product.save();
    }

    await Category.updateOne(
      { _id: categoryId },
      { $set: { categoryOffer: 0 } }
    );

    res.json({ status: true, message: 'Category offer removed successfully' });
  } catch (error) {
    console.error('Error in removeCategoryOffer:', error);
    res.status(500).json({ status: false, message: 'Internal server error' });
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