const User = require('../../models/userSchema');

const customerInfo = async (req, res) => {
  try {
    let search = '';
    if (req.query.search) {
      search = req.query.search;
    }

    let page = 1;
    if (req.query.page) {
      page = parseInt(req.query.page);
    }

    const limit = 10;

   const userData = await User.find({
  isAdmin: false,
  $or: [
    { firstname: { $regex: '.*' + search + '.*', $options: 'i' } },
    { email: { $regex: '.*' + search + '.*', $options: 'i' } },
    { phone: { $regex: '.*' + search + '.*', $options: 'i' } } 
  ]
})
.limit(limit)
.skip((page - 1) * limit)
.exec();

const count = await User.countDocuments({
  isAdmin: false,
  $or: [
    { firstname: { $regex: '.*' + search + '.*', $options: 'i' } },
    { email: { $regex: '.*' + search + '.*', $options: 'i' } },
    { phone: { $regex: '.*' + search + '.*', $options: 'i' } }
  ]
});

    const totalPages = Math.ceil(count / limit);

    res.render('users', {
      data: userData, 
      currentPage: page,
      totalPages,
      searchQuery: search
    });

  } catch (error) {
    console.log('Error in customerInfo:', error);
    res.status(500).send("Server Error");
  }
};

const customerBlocked=async(req,res)=>{
  try {
    let id=req.query.id;
    await User.updateOne({_id:id},{$set:{isBlocked:true}})
    res.redirect('/admin/users')
  } catch (error) {
  res.redirect('/pageerror')    
  }
};


const customerUnBlocked=async(req,res)=>{
  try {
    let id=req.query.id;
    await User.updateOne({_id:id},{$set:{isBlocked:false}})
    res.redirect('/admin/users')
  } catch (error) {
    res.redirect('/pageerror')
  }
}







module.exports = {
  customerInfo,
  customerBlocked,
  customerUnBlocked
};
