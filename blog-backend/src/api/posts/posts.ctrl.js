const Post = require('models/post');
const Joi = require('joi');

const { ObjectId } = require('mongoose').Types;

// ObjectId 검증
// src/api/posts/index.js 에서 checkObjectId를 활용한다.
exports.checkObjectId = (ctx, next) => {
  const { id } = ctx.params;

  // 검증 실패
  if (!ObjectId.isValid(id)) {
    ctx.status = 400; // 400 Bad Request
    return null;
  }

  return next(); // next를 리턴해주어야 ctx.body가 제대로 설정됩니다.
};

// 인증함수
exports.checkLogin = (ctx, next) => {
  if(!ctx.session.logged){
    ctx.status = 401; // Unauthorized
    return null;
  }
  return next();
}

/*
  POST /api/posts
  { title, body, tags }
*/
/*
  Request Body 검증)
  포스트를 작성할 떄 서버는 title, body, tags 값을 모두 전달받는다.
  클라이언트가 값을 빼먹었을 때는 400 오류가 발생해야 한다.
  지금은 따로 처리하지 않았기 때문에, 요청 내용을 비운상태에서
  write API를 실행해도 요청이 성공하여 비어 있는 포스트가 등록이 된다.
  객체를 검증하려고 각 값을 if문으로 검증하는 방법도 있지만, 이를 수월하게 하는 라이브러리인
  Joi를 설치하여 사용한다. 
*/
// await 를 사용할려면 async 를 붙여줘야한다.
exports.write = async (ctx) => {

  // 객체가 지닌 값들을 검증합니다.
  const schema = Joi.object().keys({
    title: Joi.string().required(), // 뒤에 required를 붙여주면 필수 항목이라는 의미
    body: Joi.string().required(),
    tags: Joi.array().items(Joi.string()).required() // 문자열 배열
  });

  // 첫 번째 파라미터는 검증할 객체, 두 번째는 스키마
  const result = Joi.validate(ctx.request.body, schema);

  // 오류 발생 시 오류 내용 응답
  if (result.error) {
    ctx.status = 400;
    ctx.body = result.error;
    return;
  }

  const { title, body, tags } = ctx.request.body;

  // 새 Post 인스턴스를 생성합니다.
  const post = new Post({
    title, body, tags
  });

  try {
    await post.save(); // 데이터베이스에 등록합니다.
    ctx.body = post; // 저장된 결과를 반환합니다.
  } catch (e) {
    // 데이터베이스의 오류 발생
    ctx.throw(e, 500);
  }
};


/*
  GET /api/posts
*/
exports.list = async (ctx) => {
  // page가 주어지지 않았다면 1로 간주
  // query는 문자열 형태로 받아오므로 숫자로 변환
  const page = parseInt(ctx.query.page || 1, 10);
  const { tag } = ctx.query;

  const query = tag ? {
    tags: tag // tags 배열에 tag를 가진 포스트 찾기
  } : {};

  // 잘못된 페이지가 주어졌다면 오류
  if (page < 1) {
    ctx.status = 400;
    return;
  }  

  // .sort({ _id: -1 }) -> 역순
  // limit() -> 갯수 제한
  // skip -> 페이지기능 관련 코드 ex) posts?page=2
  //  └ skip 는 넘기다라는 뜻, 파라미터로 10을 넣어주면 첫 열개를 제외하고, 그 다음 데이터를 불러온다.
  // lean -> 내용 길이 제한 -> const limitBodyLength 관련코드 -> JSON형식으로 반환
  // └ 쿼리를 할 때 lean 함수를 사용하여 처음부터 JSON 형태로 조회하는 방법
  // exec 붙여야만 서버에 쿼리를 요청
  try {
    const posts = await Post.find(query)
      .sort({ _id: -1 })
      .limit(10)
      .skip((page - 1) * 10)
      .lean()
      .exec();

    // Documents 총갯수 구하기
    const postCount = await Post.countDocuments().exec();

    // 350자 제한
    const limitBodyLength = post => ({
      ...post,
      body: post.body.length < 350 ? post.body : `${post.body.slice(0, 350)}...`
    });
    ctx.body = posts.map(limitBodyLength);

    // 마지막 페이지 알려주기
    // ctx.set은 response header를 설정해줍니다.
    ctx.set('Last-Page', Math.ceil(postCount / 10));
  } catch (e) {
    ctx.throw(500, e);
  }
};


/*
  GET /api/posts/:id
*/
exports.read = async (ctx) => {
  const { id } = ctx.params;
  try {
    // findById : 특정 id를 가진 데이터를 조회
    const post = await Post.findById(id).exec();

    // 포스트가 존재하지 않음
    if (!post) {
      ctx.status = 404;
      return;
    }
    ctx.body = post;
  } catch (e) {
    ctx.throw(e, 500);
  }
};


/*
  DELETE /api/posts/:id
*/
/*
  remove : 특정 조건을 만족하는 데이터들을 모두 지운다.
  findByIdAndRemove : id를 찾아서 지운다.
  findOneAndRemove : 특정 조건을 만족하는 데이터 하나를 찾아서 제거한다
*/
exports.remove = async (ctx) => {
  const { id } = ctx.params;
  try {
    await Post.findByIdAndRemove(id).exec();
    ctx.status = 204;
  } catch (e) {
    ctx.throw(e, 500);
  }
};


/*
  PATCH /api/posts/:id
  { title, body, tags }
*/
exports.update = async (ctx) => {
  const { id } = ctx.params;
  try {
    // findByIdAndUpdate : 첫번쨰 파라미터는 id고, 두 번째 파라미터는 업데이트 내용이며, 세번째 파라미터는 업데이트의 설정 객체
    const post = await Post.findByIdAndUpdate(id, ctx.request.body, {
      new: true
      // 이 값을 설정해 주어야 업데이트된 객체를 반환합니다.
      // 설정하지 않으면 업데이트되기 전의 객체를 반환합니다.
    }).exec();

    // 포스트가 존재하지 않을 시
    if (!post) {
      ctx.status = 404;
      return;
    }
    ctx.body = post;
  } catch (e) {
    ctx.throw(e, 500);
  }
};