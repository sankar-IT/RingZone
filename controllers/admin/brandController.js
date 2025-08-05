const Brand=require('../../models/brandSchema')
const Product =require('../../models/productsSchema')


const getBrandPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

   
    const testBrand = await Brand.findOne().sort({ createdAt: -1 });
    if (!testBrand || !testBrand.createdAt) {
      console.log('Warning: createdAt field missing or empty in brands');
    }

    
    const sortOption = { createdAt: -1 }; 
    
   

    const [totalBrands, brands] = await Promise.all([
      Brand.countDocuments(search ? { brandName: { $regex: search, $options: 'i' } } : {}),
      Brand.find(search ? { brandName: { $regex: search, $options: 'i' } } : {})
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

 
    console.log('First brand in results:', brands[0]?.brandName, brands[0]?.createdAt);
    console.log('Last brand in results:', brands[brands.length-1]?.brandName, brands[brands.length-1]?.createdAt);

    res.render('brands', {
      cat: brands,
      currentPage: page,
      totalPages: Math.ceil(totalBrands / limit),
      searchQuery: search
    });

  } catch (error) {
    console.error("Error in getBrandPage:", error);
    res.redirect('/pageerror');
  }
};


const addBrand=async(req,res)=>{
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

module.exports={

  getBrandPage,
  addBrand,
  blockBrand,
  unBlockBrand,
}