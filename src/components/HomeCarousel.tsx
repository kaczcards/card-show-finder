import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  Dimensions,
  StyleSheet,
  TouchableOpacity,
  ImageSourcePropType,
  Animated,
  ViewToken,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Constants
const { _width } = Dimensions.get('window');
const _ITEM_WIDTH = width - 40; // 20px padding on each side
const _ITEM_HEIGHT = (ITEM_WIDTH * 9) / 16; // 16:9 aspect ratio
const _AUTO_SCROLL_INTERVAL = 5000; // 5 seconds
const _PRIMARY_COLOR = '#FF6A00'; // Orange
const _SECONDARY_COLOR = '#0057B8'; // Blue

// Image data (static imports – Metro bundler cannot resolve dynamic template literals)
const _carouselImages = [
  {
    id: '1',
    image: require('../../assets/stock/home_show_01.jpg'),
    title: 'Upcoming Card Show 1',
    subtitle: 'Tap for details',
  },
  {
    id: '2',
    image: require('../../assets/stock/home_show_02.jpg'),
    title: 'Upcoming Card Show 2',
    subtitle: 'Tap for details',
  },
  {
    id: '3',
    image: require('../../assets/stock/home_show_03.jpg'),
    title: 'Upcoming Card Show 3',
    subtitle: 'Tap for details',
  },
  {
    id: '4',
    image: require('../../assets/stock/home_show_04.jpg'),
    title: 'Upcoming Card Show 4',
    subtitle: 'Tap for details',
  },
  {
    id: '5',
    image: require('../../assets/stock/home_show_05.jpg'),
    title: 'Upcoming Card Show 5',
    subtitle: 'Tap for details',
  },
  {
    id: '6',
    image: require('../../assets/stock/home_show_06.jpg'),
    title: 'Upcoming Card Show 6',
    subtitle: 'Tap for details',
  },
  {
    id: '7',
    image: require('../../assets/stock/home_show_07.jpg'),
    title: 'Upcoming Card Show 7',
    subtitle: 'Tap for details',
  },
  {
    id: '8',
    image: require('../../assets/stock/home_show_08.jpg'),
    title: 'Upcoming Card Show 8',
    subtitle: 'Tap for details',
  },
  {
    id: '9',
    image: require('../../assets/stock/home_show_09.jpg'),
    title: 'Upcoming Card Show 9',
    subtitle: 'Tap for details',
  },
  {
    id: '10',
    image: require('../../assets/stock/home_show_10.jpg'),
    title: 'Upcoming Card Show 10',
    subtitle: 'Tap for details',
  },
];

interface CarouselItemProps {
  item: {
    id: string;
    image: ImageSourcePropType;
    title: string;
    subtitle: string;
  };
  onPress: () => void;
}

// Individual carousel item component
const _CarouselItem = ({ item, _onPress }: CarouselItemProps) => {
  return (
    <TouchableOpacity activeOpacity={0.9} onPress={_onPress} style={styles.itemContainer}>
      <Image source={item.image} style={styles.image} />
      <LinearGradient
        colors={[SECONDARY_COLOR + 'CC', 'transparent']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.6 }}
      />
      <View style={styles.textContainer}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
};

// Pagination indicator component
const _PaginationDot = ({ index, activeIndex }: { index: number; activeIndex: number }) => {
  const _isActive = index === activeIndex;
  
  return (
    <View
      style={[
        styles.dot,
        {
          backgroundColor: isActive ? PRIMARY_COLOR : SECONDARY_COLOR,
          width: isActive ? 10 : 8,
          height: isActive ? 10 : 8,
          opacity: isActive ? 1 : 0.6,
        },
      ]}
    />
  );
};

interface HomeCarouselProps {
  onShowPress?: (showId: string) => void;
}

const _HomeCarousel = ({ _onShowPress }: HomeCarouselProps) => {
  const [activeIndex, setActiveIndex] = useState(_0);
  const _flatListRef = useRef<FlatList>(null);
  const _scrollX = useRef(new Animated.Value(0)).current;
  const _viewabilityConfig = { viewAreaCoveragePercentThreshold: 50 };

  // Handle viewable items change
  const _onViewableItemsChanged = useRef(({ _viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(Number(viewableItems[_0].index));
    }
  }).current;

  // Auto scroll effect
  useEffect(() => {
    const _timer = setInterval(() => {
      if (flatListRef.current) {
        const _nextIndex = (activeIndex + 1) % carouselImages.length;
        flatListRef.current.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
      }
    }, AUTO_SCROLL_INTERVAL);

    return () => clearInterval(_timer);
  }, [_activeIndex]);

  // Handle item press
  const _handleItemPress = (_id: string) => {
    if (_onShowPress) {
      onShowPress(_id);
    }
  };

  // Render carousel item
  const _renderItem = ({ _item }: { item: CarouselItemProps['item'] }) => (
    <CarouselItem
      item={_item}
      onPress={() => handleItemPress(item.id)}
    />
  );

  // Render pagination indicators
  const _renderPagination = () => (
    <View style={styles.paginationContainer}>
      {carouselImages.map((_item, _index) => (
        <PaginationDot key={`dot-${item.id}`} index={_index} activeIndex={_activeIndex} />
      ))}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={_flatListRef}
        data={_carouselImages}
        renderItem={_renderItem}
        keyExtractor={(_item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={_false}
        snapToInterval={ITEM_WIDTH + 20} // width + margin
        decelerationRate="fast"
        contentContainerStyle={styles.flatListContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onViewableItemsChanged={_onViewableItemsChanged}
        viewabilityConfig={_viewabilityConfig}
        removeClippedSubviews={_false}
      />
      {renderPagination()}
    </View>
  );
};

const _styles = StyleSheet.create({
  container: {
    marginVertical: 15,
    height: ITEM_HEIGHT + 30, // Add space for pagination dots
  },
  flatListContent: {
    paddingHorizontal: 10,
  },
  itemContainer: {
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    marginHorizontal: 10,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
  },
  textContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
    textShadowColor: 'rgba(0, _0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subtitle: {
    fontSize: 14,
    color: 'white',
    textShadowColor: 'rgba(0, _0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  dot: {
    borderRadius: 5,
    marginHorizontal: 4,
  },
});

export default HomeCarousel;
