import ThePreviewThumbnail from '@/components/PlayingView/ThePreviewThumbnail';
import { shallowMount } from '@vue/test-utils';
import sinon from 'sinon';

describe('Component - ThePreviewThumbnail', () => {
  let wrapper;
  let sandbox;

  it('Sanity - should ThePreviewThumbnail be rendered', () => {
    wrapper = shallowMount(ThePreviewThumbnail);

    expect(wrapper.contains(ThePreviewThumbnail)).to.equal(true);
  });

  const propsData = {
    src: 'file:///',
    currentTime: 0,
    maxThumbnailWidth: 240,
    videoRatio: 1.78,
    thumbnailWidth: 135,
    thumbnailHeight: 76,
  };
  beforeEach(() => {
    sandbox = sinon.createSandbox();
    wrapper = shallowMount(ThePreviewThumbnail, { propsData });
    wrapper.vm.quickHash = '84f0e9e5e05f04b58f53e2617cc9c866-'
                          + 'f54d6eb31bef84839c3ce4fc2f57991c-'
                          + 'b1f0696aec64577228d93eabcc8eb69b-'
                          + 'f497c6684c4c6e50d0856b5328a4bedc';
  });
  afterEach(() => {
    wrapper.destroy();
    sandbox.restore();
  });

  it('should switch src reload ThumbnailDisplay and ThumbnailVideoPlayer', () => {
    wrapper.setProps({ src: 'http:///' });

    expect(wrapper.vm.mountVideo && wrapper.vm.mountImage).to.equal(false);
  });
  it('should switch currentTime update display and currentTimes', () => {
    wrapper.setProps({ currentTime: 90 });
  });
});
