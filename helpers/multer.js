const multer = require("multer");
const path = require("path");



const categoryStorage = multer.diskStorage({
  destination: function (req, file, cb) { 
    cb(null, "public/uploads/re-image");
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
    cb(null, uniqueName);
  }
});



const productStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/products");
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
    cb(null, uniqueName);
  }
});



const profileStorage=multer.diskStorage({
  destination:function(req,file,cb){
    cb(null,"public/uploads/profile");
  },
  filename:function (req,file,cb){
    const ext=path.extname(file.originalname);
    const uniqueName= Date.now() + '-'+ Math.round(Math.random() * 1E9) + ext;
    cb(null,uniqueName);
  }
})

const uploadCategory = multer({ storage: categoryStorage });


const uploadProduct = multer({ storage: productStorage });


const uploadProfile = multer({ 
  storage: profileStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, 
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only .jpeg, .jpg, and .png files are allowed'));
  }
});




const productUploadFields = [
  { name: 'productImages', maxCount: 10 },
  { name: 'variantImages-variant-1', maxCount: 5 },
  { name: 'variantImages-variant-2', maxCount: 5 },
  { name: 'variantImages-variant-3', maxCount: 5 },
  { name: 'variantImages-variant-4', maxCount: 5 },
];

const uploadProductEdit = multer({ storage: productStorage }).fields(productUploadFields);

module.exports = {
  uploadCategory,
  uploadProduct,
  uploadProductEdit,
  uploadProfile
};
