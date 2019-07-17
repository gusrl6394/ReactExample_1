import React from 'react';
import { Switch, Route } from 'react-router-dom';
import { ListPage, PostPage, EditorPage, NotFoundPage } from 'pages';
import Base from 'containers/common/Base';

/*
  1. 홈
  2. 포스트 목록
  3. 포스트 목록(태그 설정)
  4. 포스트 읽기
  5. 에디터
  6. 404 페이지
*/
const App = () => {
  return (
    <div>
      <Switch>
        <Route exact path="/" component={ListPage}/>
        <Route path="/page/:page" component={ListPage}/>
        <Route path="/tag/:tag/:page?" component={ListPage}/>
        <Route path="/post/:id" component={PostPage}/>
        <Route path="/editor" component={EditorPage}/>
        <Route component={NotFoundPage}/>
      </Switch>
      <Base/>
    </div>
  );
};

export default App;