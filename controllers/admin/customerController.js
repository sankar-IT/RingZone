const User = require('../../models/userSchema');

const customerInfo = async (req, res) => {
  try {
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const sort = req.query.sort || '';
    const gender = req.query.gender || '';
    const limit = 10;

    const query = {
      isAdmin: false,
      $or: [
        { firstname: { $regex: '.*' + search + '.*', $options: 'i' } },
        { email: { $regex: '.*' + search + '.*', $options: 'i' } },
        { phone: { $regex: '.*' + search + '.*', $options: 'i' } }
      ]
    };

    if (gender) {
      query.gender = gender === 'none' ? null : gender;
    }

    let sortOption = {};
    if (sort === 'az') sortOption = { firstname: 1 };
    else if (sort === 'za') sortOption = { firstname: -1 };

    const userData = await User.find(query)
      .sort(sortOption)
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const count = await User.countDocuments(query);
    const totalPages = Math.ceil(count / limit);

    res.render('users', {
      data: userData,
      currentPage: page,
      totalPages,
      searchQuery: search,
      sort,
      gender
    });

  } catch (error) {
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
