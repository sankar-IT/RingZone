const Brand=require('../../models/brandSchema')
const Product =require('../../models/productsSchema')


const getBrandPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const search = req.query.search || '';

   const query = search
  ? {
      brandName: { $regex: new RegExp(search, 'i') }
    }
  : {};

    const totalBrands = await Brand.countDocuments(query);
const brands = await Brand.find(query)
  .sort({ createdAt: -1 })
  .skip((page - 1) * limit)
  .limit(limit);

res.render('brands', {
  cat: brands,  // or rename to `brands` for clarity
  currentPage: page,
  totalPages: Math.ceil(totalBrands / limit),
  searchQuery: search,
});

  } catch (error) {
    console.error("Error in getBrandPage:", error);
    res.redirect('/pageerror');
  }
};



const addBrand=async(req,res)=>{

  console.log(req.body);
  
  try {
    const brand=req.body.name;
const findBrand = await Brand.findOne({ brandName: brand });
    if(!findBrand){
      const image=req.file.filename;
      const newBrand=new Brand({
        brandName:brand,
        brandImage:image
      })
      await newBrand.save()
      res.redirect('/admin/brands')
    }
  } catch (error) {
    res.redirect('/pageerror')
  }
}

const blockBrand=async(req,res)=>{
  try {
    const id=req.query.id;
    await Brand.updateOne({_id:id},{$set:{isBlocked:true}})
    res.redirect('/admin/brands')
  } catch (error) {
    
  }
}

const unBlockBrand=async(req,res)=>{
  try{
   const id=req.query.id;
   await Brand.updateOne({_id:id},{$set:{isBlocked:false}})
   res.redirect('/admin/brands')
  }catch(error){
res.redirect('/pageerror')
  }
}

const deleteBrand = async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).redirect('/pageerror');
    }

    await Brand.deleteOne({ _id: id });

    res.redirect('/admin/brands');
  } catch (error) {
    console.error('Error deleting brand:', error);
    res.status(500).redirect('/pageerror');
  }
};


module.exports={

  getBrandPage,
  addBrand,
  blockBrand,
  unBlockBrand,
  deleteBrand
}