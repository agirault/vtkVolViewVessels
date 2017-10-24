import React from 'react';
import PropTypes from 'prop-types';

import vtkPicker                      from 'vtk.js/Sources/Rendering/Core/CellPicker';
import vtkImageMapper                 from 'vtk.js/Sources/Rendering/Core/ImageMapper';
import vtkImageSlice                  from 'vtk.js/Sources/Rendering/Core/ImageSlice';
import vtkOpenGLRenderWindow          from 'vtk.js/Sources/Rendering/OpenGL/RenderWindow';
// import vtkPickerInteractorStyle   from 'vtk.js/Sources/Rendering/Core/CellPicker/example/PickerInteractorStyle';
import vtkRenderer                    from 'vtk.js/Sources/Rendering/Core/Renderer';
import vtkRenderWindow                from 'vtk.js/Sources/Rendering/Core/RenderWindow';
import vtkRenderWindowInteractor      from 'vtk.js/Sources/Rendering/Core/RenderWindowInteractor';

import vtkTubePickerInteractorStyle   from '../util/TubePickerInteractorStyle';

import style from '../Tube.mcss';

export default class SliceViewer extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      windowMin: 0,
      windowMax: 10,
      windowValue: 0,

      levelMin: 0,
      levelMax: 10,
      levelValue: 0,

      slice: 0,
      sliceMax: 0,
    };

    this.currentSlicingMode = 2;

    // Create vtk.js rendering pieces
    this.renderWindow = vtkRenderWindow.newInstance();
    this.renderer = vtkRenderer.newInstance();
    this.renderWindow.addRenderer(this.renderer);
    this.openGlRenderWindow = vtkOpenGLRenderWindow.newInstance();
    this.renderWindow.addView(this.openGlRenderWindow);
    this.interactor = vtkRenderWindowInteractor.newInstance();
    this.interactor.setView(this.openGlRenderWindow);

    this.actor = vtkImageSlice.newInstance();
    this.mapper = vtkImageMapper.newInstance(); // { renderToRectangle: true }
    this.actor.setMapper(this.mapper);
    this.camera = this.renderer.getActiveCamera();
    this.camera.setParallelProjection(true);

    // Setup picking
    this.picker = vtkPicker.newInstance();
    this.picker.setPickFromList(true);
    this.picker.initializePickList();
    this.picker.addPickList(this.actor);

    this.iStyle = vtkTubePickerInteractorStyle.newInstance();
    this.renderWindow.getInteractor().setInteractorStyle(this.iStyle);
    this.renderWindow.getInteractor().setPicker(this.picker);

    // Add pick listener
    this.picker.onPickChange(() => {
      const { actors, cellIJK } = this.picker.get('cellIJK', 'actors');
      if (actors.length && this.props.onPickIJK) {
        this.props.onPickIJK(...cellIJK);
      }
    });
  }

  componentDidMount() {
    this.openGlRenderWindow.setContainer(this.renderWindowContainer);
    this.interactor.initialize();
    this.interactor.bindEvents(this.renderWindowContainer);
    this.resize();
  }

  componentWillReceiveProps(props) {
    if (props.imageData !== this.props.imageData) {
      const needToAddActor = this.props.imageData == null;
      this.mapper.setInputData(props.imageData);

      const range = props.imageData.getPointData().getScalars().getRange();
      this.setState((prevState, _props) => ({
        windowMin: 0,
        windowMax: (range[1] - range[0]),
        windowValue: (range[1] - range[0]),
        levelMin: range[0],
        levelMax: range[1],
        levelValue: (range[1] + range[0]) * 0.5,
      }));

      if (needToAddActor) {
        this.renderer.addActor(this.actor);
        this.mapper.setCurrentSlicingMode(this.currentSlicingMode);
        this.mapper.setZSlice(0);
        const position = this.camera.getFocalPoint().map((v, idx) => (idx === this.currentSlicingMode ? (v + 1) : v));
        const viewUp = [0, 0, 0];
        viewUp[(this.currentSlicingMode + 2) % 3] = 1;
        this.camera.set({ position, viewUp });
        this.renderer.resetCamera();
        this.renderer.resetCameraClippingRange();
        this.updateRenderer();
      }
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (prevState.windowValue !== this.state.windowValue) {
      this.actor.getProperty().setColorWindow(this.state.windowValue);
      this.updateRenderer();
    }

    if (prevState.levelValue !== this.state.levelValue) {
      this.actor.getProperty().setColorLevel(this.state.levelValue);
      this.updateRenderer();
    }

    if (prevState.slice !== this.state.slice) {
      this.mapper[`set${'XYZ'[this.currentSlicingMode]}Slice`](this.state.slice);
      this.updateRenderer();
    }

    if (prevProps.imageData !== this.props.imageData) {
      this.resetSliceSlider();
      this.updateRenderer();
    }
  }

  onLevelChanged(value) {
    this.setState((prevState, props) => ({ levelValue: Number(value) }));
  }

  onWindowChanged(value) {
    this.setState((prevState, props) => ({ windowValue: Number(value) }));
  }

  onSliceChanged(value) {
    this.setState((prevState, props) => ({ slice: value }));
  }

  resize() {
    if (this.renderWindowContainer) {
      this.boundingRect = this.renderWindowContainer.getBoundingClientRect();
      this.openGlRenderWindow.setSize(this.boundingRect.width, this.boundingRect.height);
      this.renderer.resetCamera();
      this.renderer.resetCameraClippingRange();
      this.updateRenderer();
    }
  }

  updateRenderer() {
    this.renderWindow.render();
  }

  resetSliceSlider() {
    const max = this.props.imageData.getDimensions()[this.currentSlicingMode] - 1;
    const value = Math.ceil(max / 2);
    this.setState((prevState, props) => ({ sliceMax: max, slice: value }));
  }

  render() {
    return (
      <div className={['js-left-pane', style.itemStretch].join(' ')}>
        <div ref={(r) => { this.renderWindowContainer = r; }} className={['js-renderer', style.itemStretch, style.overflowHidder].join(' ')} />
        <div className={[style.horizontalContainer, style.controlLine].join(' ')}>
          <label className={style.label}>Window</label>
          <input
            className={['js-slider-window', style.slider].join(' ')}
            type="range"
            min={this.state.windowMin}
            value={this.state.windowValue}
            max={this.state.windowMax}
            onInput={ev => this.onWindowChanged(ev.target.value)}
          />
          <label className={style.label}>Level</label>
          <input
            className={['js-slider-level', style.slider].join(' ')}
            type="range"
            min={this.state.levelMin}
            value={this.state.levelValue}
            max={this.state.levelMax}
            onInput={ev => this.onLevelChanged(ev.target.value)}
          />
        </div>
        <div className={[style.horizontalContainer, style.controlLine].join(' ')}>
          <div className={['js-slice-normal-button', style.button].join(' ')} data-current-slicing-mode="0">X</div>
          <div className={['js-slice-normal-button', style.button].join(' ')} data-current-slicing-mode="1">Y</div>
          <div className={['js-slice-normal-button', style.button].join(' ')} data-current-slicing-mode="2">Z</div>
          <input
            className={['js-slider-slice', style.slider].join(' ')}
            type="range"
            min="0"
            value={this.state.slice}
            max={this.state.sliceMax}
            onInput={ev => this.onSliceChanged(Number(ev.target.value))}
          />
        </div>
      </div>
    );
  }
}

SliceViewer.propTypes = {
  onPickIJK: PropTypes.func,
  imageData: PropTypes.object,
};

SliceViewer.defaultProps = {
  onPickIJK: null,
  imageData: null,
};


/*
import vtkPicker                      from 'vtk.js/Sources/Rendering/Core/CellPicker';
import vtkImageMapper                 from 'vtk.js/Sources/Rendering/Core/ImageMapper';
import vtkImageSlice                  from 'vtk.js/Sources/Rendering/Core/ImageSlice';
import vtkOpenGLRenderWindow          from 'vtk.js/Sources/Rendering/OpenGL/RenderWindow';
// import vtkPickerInteractorStyle   from 'vtk.js/Sources/Rendering/Core/CellPicker/example/PickerInteractorStyle';
import vtkRenderer                    from 'vtk.js/Sources/Rendering/Core/Renderer';
import vtkRenderWindow                from 'vtk.js/Sources/Rendering/Core/RenderWindow';
import vtkRenderWindowInteractor      from 'vtk.js/Sources/Rendering/Core/RenderWindowInteractor';

import vtkTubePickerInteractorStyle   from '../util/TubePickerInteractorStyle';
import style from '../Tube.mcss';

const htmlTemplate = `
  <div class="js-renderer ${style.itemStretch} ${style.overflowHidder}"></div>
  <div class="${style.horizontalContainer} ${style.controlLine}">
    <label class="${style.label}">Window</label>
    <input class="js-slider-window ${style.slider}" type="range" min="0" value="0" max="10" />
    <label class="${style.label}">Level</label>
    <input class="js-slider-level ${style.slider}" type="range" min="0" value="0" max="10" />
  </div>
  <div class="${style.horizontalContainer} ${style.controlLine}">
    <div class="js-slice-normal-button ${style.button}" data-current-slicing-mode="0">X</div>
    <div class="js-slice-normal-button ${style.button}" data-current-slicing-mode="1">Y</div>
    <div class="js-slice-normal-button ${style.button}" data-current-slicing-mode="2">Z</div>
    <input class="js-slider-slice ${style.slider}" type="range" min="0" value="0" max="10" />
  </div>
`;

function updateSlider(el, props, forceUpdate = true) {
  Object.keys(props).forEach((attributeName) => {
    if (attributeName === 'value') {
      el.value = props[attributeName];
    } else {
      el.setAttribute(attributeName, props[attributeName]);
    }
  });
  if (forceUpdate) {
    el.dispatchEvent(new Event('input'));
  }
}

export default class SliceViewer {
  constructor(container) {
    this.listeners = [];
    this.currentSlicingMode = 2;
    this.root = container;
    container.classList.add(style.verticalContainer);
    container.innerHTML = htmlTemplate;

    this.renderWindowContainer = container.querySelector('.js-renderer');
    this.windowSlider = container.querySelector('.js-slider-window');
    this.levelSlider = container.querySelector('.js-slider-level');
    this.sliceSlider = container.querySelector('.js-slider-slice');

    // Create vtk.js rendering pieces
    this.renderWindow = vtkRenderWindow.newInstance();
    this.renderer = vtkRenderer.newInstance();
    this.renderWindow.addRenderer(this.renderer);
    this.openGlRenderWindow = vtkOpenGLRenderWindow.newInstance();
    this.renderWindow.addView(this.openGlRenderWindow);
    this.interactor = vtkRenderWindowInteractor.newInstance();
    this.interactor.setView(this.openGlRenderWindow);

    this.actor = vtkImageSlice.newInstance();
    this.mapper = vtkImageMapper.newInstance(); // { renderToRectangle: true }
    this.actor.setMapper(this.mapper);
    this.camera = this.renderer.getActiveCamera();
    this.camera.setParallelProjection(true);

    this.openGlRenderWindow.setContainer(this.renderWindowContainer);
    this.interactor.initialize();
    this.interactor.bindEvents(this.renderWindowContainer);
    this.resize();

    // Setup picking
    this.picker = vtkPicker.newInstance();
    this.picker.setPickFromList(true);
    this.picker.initializePickList();
    this.picker.addPickList(this.actor);

    this.iStyle = vtkTubePickerInteractorStyle.newInstance();
    this.renderWindow.getInteractor().setInteractorStyle(this.iStyle);
    this.renderWindow.getInteractor().setPicker(this.picker);

    // Add pick listener
    this.picker.onPickChange(() => {
      const { actors, cellIJK } = this.picker.get('cellIJK', 'actors');
      if (actors.length) {
        this.listeners.forEach(l => l(...cellIJK));
      }
    });

    // Add DOM listeners
    this.windowSlider.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      this.actor.getProperty().setColorWindow(value);
      this.render();
    });

    this.levelSlider.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      this.actor.getProperty().setColorLevel(value);
      this.render();
    });

    // Synch UI based on prop change
    this.actor.getProperty().onModified(() => {
      const { colorWindow, colorLevel } = this.actor.getProperty().get('colorWindow', 'colorLevel');
      updateSlider(this.levelSlider, { value: colorLevel }, false);
      updateSlider(this.windowSlider, { value: colorWindow }, false);
    });

    this.sliceSlider.addEventListener('input', (event) => {
      const value = Number(event.target.value);
      this.mapper[`set${'XYZ'[this.currentSlicingMode]}Slice`](value);
      this.render();
    });

    [].forEach.call(container.querySelectorAll('.js-slice-normal-button'), (button) => {
      button.addEventListener('click', (event) => {
        this.currentSlicingMode = Number(event.target.dataset.currentSlicingMode);
        this.mapper.setCurrentSlicingMode(this.currentSlicingMode);
        this.mapper[`set${'XYZ'[this.currentSlicingMode]}Slice`](0); // FIXME force change to render (bug in imageMapper)

        const position = this.camera.getFocalPoint().map((v, idx) => (idx === this.currentSlicingMode ? (v + 1) : v));
        const viewUp = [0, 0, 0];
        viewUp[(this.currentSlicingMode + 2) % 3] = 1;
        this.camera.set({ position, viewUp });
        this.renderer.resetCamera();
        this.renderer.resetCameraClippingRange();
        this.render();
        this.updateSliceSlider();
      });
    });
  }

  updateSliceSlider() {
    if (this.dataset) {
      const max = this.dataset.getDimensions()[this.currentSlicingMode] - 1;
      const value = Math.ceil(max / 2);
      updateSlider(this.sliceSlider, { max, value });
      this.render();
    }
  }

  updateData(imageDataToLoad) {
    const needToAddActor = !this.dataset;
    this.dataset = imageDataToLoad;
    this.mapper.setInputData(this.dataset);

    const range = imageDataToLoad.getPointData().getScalars().getRange();
    updateSlider(this.windowSlider, { min: 0, max: (range[1] - range[0]), value: (range[1] - range[0]) });
    updateSlider(this.levelSlider, { min: range[0], max: range[1], value: (range[1] + range[0]) * 0.5 });

    if (needToAddActor) {
      this.renderer.addActor(this.actor);
      this.mapper.setCurrentSlicingMode(this.currentSlicingMode);
      this.mapper.setZSlice(0);
      const position = this.camera.getFocalPoint().map((v, idx) => (idx === this.currentSlicingMode ? (v + 1) : v));
      const viewUp = [0, 0, 0];
      viewUp[(this.currentSlicingMode + 2) % 3] = 1;
      this.camera.set({ position, viewUp });
      this.renderer.resetCamera();
      this.renderer.resetCameraClippingRange();
      this.render();
    }

    this.updateSliceSlider();
  }

  render() {
    this.renderWindow.render();
  }

  resize() {
    if (this.renderWindowContainer) {
      this.boundingRect = this.renderWindowContainer.getBoundingClientRect();
      this.openGlRenderWindow.setSize(this.boundingRect.width, this.boundingRect.height);
      this.renderer.resetCamera();
      this.renderer.resetCameraClippingRange();
      this.render();
    }
  }

  onTubeRequest(callback) {
    this.listeners.push(callback);
  }
}
*/
